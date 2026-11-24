/**
 * 性能控制 —— 宿主侧。
 *
 * 一根 0–100 的滑块存在自己的状态文件里，落到 Windows Job Object 的 CPU 速率上限。
 * 页面通过 /api/dsh-perf-control/* 这一条本机路由读状态、写设置。
 *
 * 为什么走 HTTP 而不是 settings 服务：设置项写进 loader 配置会重启插件，
 * 拖一次滑块重启一次，体验太差；而且重启会重新 apply。这里用独立状态文件，
 * 改完当场生效，不重启。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { applyLimit, backendStatus, releaseLimit } from './lib/job.mjs'

export const name = 'dsh-perf-control'

const ROUTE = '/api/dsh-perf-control'
/** 默认不限制，装完不改就不影响任何东西。 */
const DEFAULT_LIMIT = 100
// 下限 5%：再低整个树（含界面）就转不动了。100 = 不限制。
const MIN_LIMIT = 5

function dshHome() {
  const configured = process.env.DSH_HOME
  if (typeof configured === 'string' && configured.trim() !== '') return configured
  return join(homedir(), '.dsh')
}

const STATE_DIR = join(dshHome(), 'perf-control')
const STATE_FILE = join(STATE_DIR, 'state.json')

function readLimit() {
  try {
    const value = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    const limit = Number(value?.limit)
    if (Number.isFinite(limit)) return Math.min(100, Math.max(MIN_LIMIT, Math.round(limit)))
  } catch {
    /* 没有状态文件 = 默认值 */
  }
  return DEFAULT_LIMIT
}

function writeLimit(limit) {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(STATE_FILE, `${JSON.stringify({ limit, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

/** 把最近一次落限速的结果记一笔，排查时不用翻宿主日志。 */
function recordOutcome(outcome) {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(
      join(STATE_DIR, 'last-apply.json'),
      `${JSON.stringify({ ...outcome, at: new Date().toISOString(), pid: process.pid }, null, 2)}\n`,
      'utf8',
    )
  } catch {
    /* 记不了就算了 */
  }
}

function tierOf(limit) {
  if (limit >= 100) return { key: 'off', label: '不限制' }
  if (limit > 75) return { key: 'light', label: '轻度' }
  if (limit > 50) return { key: 'normal', label: '轻度偏中' }
  if (limit > 25) return { key: 'medium', label: '中度' }
  return { key: 'hard', label: '严格' }
}

function headerValue(headers, wanted) {
  if (headers === undefined || headers === null) return undefined
  if (typeof headers.get === 'function') {
    const got = headers.get(wanted)
    return typeof got === 'string' ? got : undefined
  }
  const found = headers[wanted]
  return typeof found === 'string' ? found : undefined
}

function parseAuthority(authority) {
  try {
    return new URL('http://' + authority)
  } catch {
    return undefined
  }
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return (
    parts.length === 4 &&
    parts[0] === '127' &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  )
}

/**
 * 本机门禁：优先借 harness 的 connection.requestRejection，拿不到就只认 loopback 同源。
 * 照抄 dsh-cookie-meter 的做法，效果一样：别的机器打不进来。
 */
function makeFence(ctx) {
  function harnessConnection() {
    for (const source of [ctx, ctx.root]) {
      try {
        if (source === undefined || source === null || typeof source.get !== 'function') continue
        const connection = source.get('connection')
        if (connection === undefined || connection === null) continue
        if (typeof connection.requestRejection !== 'function') continue
        return connection
      } catch {
        /* 换下一个来源 */
      }
    }
    return undefined
  }

  return function refusal(request) {
    const connection = harnessConnection()
    if (connection !== undefined) {
      try {
        return connection.requestRejection(request)
      } catch {
        /* 退回复述 */
      }
    }
    const headers = request === undefined || request === null ? undefined : request.headers
    const host = headerValue(headers, 'host')
    if (host === undefined) return 403
    const hostUrl = parseAuthority(host)
    if (hostUrl === undefined) return 403
    if (!isLoopbackHostname(hostUrl.hostname)) return 403
    if (headerValue(headers, 'sec-fetch-site') === 'cross-site') return 403
    const origin = headerValue(headers, 'origin')
    if (origin === undefined) return undefined
    try {
      return new URL(origin).host === hostUrl.host ? undefined : 403
    } catch {
      return 403
    }
  }
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 64 * 1024) throw new Error('请求体太大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') return {}
  return JSON.parse(text)
}

function parseLimit(raw) {
  const limit = Number(raw)
  if (!Number.isFinite(limit)) throw new Error('limit 必须是数字')
  // 低于下限直接顶到 5%，不报错：滑块拉到边上而不是弹一个红条。
  return Math.min(100, Math.max(MIN_LIMIT, Math.round(limit)))
}

export function apply(ctx) {
  const fence = makeFence(ctx)

  const snapshot = () => {
    const limit = readLimit()
    return {
      ok: true,
      limit,
      tier: tierOf(limit),
      backend: backendStatus(),
      stateFile: STATE_FILE,
      updatedAt: new Date().toISOString(),
    }
  }

  function sendJson(response, status, body) {
    const text = JSON.stringify(body)
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(text)),
      'cache-control': 'no-store',
    })
    response.end(text)
  }

  // 开机按存下来的值落一次；100 就是什么都不做。
  ctx.effect(
    () => {
      const limit = readLimit()
      if (limit < 100) recordOutcome(applyLimit(limit))
      return () => releaseLimit()
    },
    'dsh-perf-control: boot apply',
  )

  ctx.inject(['webServer'], (hostCtx) => {
    hostCtx.effect(
      () =>
        hostCtx.webServer.register({
          kind: 'exact',
          path: ROUTE,
          handler: async (request, response) => {
            try {
              const rejected = fence(request)
              if (rejected !== undefined) {
                sendJson(response, rejected, { error: 'refused', status: rejected })
                return
              }
              const url = new URL(request.url === undefined ? '/' : request.url, 'http://localhost')
              const action = url.searchParams.get('action') ?? 'status'

              if (action === 'status') {
                sendJson(response, 200, snapshot())
                return
              }

              if (request.method !== 'POST') {
                sendJson(response, 405, { error: '需要 POST' })
                return
              }

              if (action === 'apply') {
                const body = await readJsonBody(request)
                const limit = parseLimit(body.limit)
                const persistError = writeLimit(limit)
                const outcome = applyLimit(limit)
                recordOutcome(outcome)
                sendJson(response, 200, { ...snapshot(), outcome, persistError })
                return
              }

              if (action === 'reset') {
                const persistError = writeLimit(100)
                releaseLimit()
                sendJson(response, 200, { ...snapshot(), outcome: { ok: true, limit: 100, rate: null }, persistError })
                return
              }

              sendJson(response, 404, { error: `未知操作 ${action}` })
            } catch (err) {
              sendJson(response, 500, { error: err instanceof Error ? err.message : String(err) })
            }
          },
        }),
      'dsh-perf-control: bridge route',
    )
  })
}
