/**
 * Windows Job Object CPU 速率控制 —— 硬限速后端。
 *
 * 只做三件事：建 Job、把主进程塞进去、改 CpuRate。
 * 孩子进程（ffmpeg / whisper / python / 渲染进程）只要是在塞进去之后生的，
 * 自动继承这个 Job，所以不需要逐个接管 spawn。
 *
 * koffi 缺失时这里不炸，只把错误记进 status，让设置页能显示"后端未就绪"。
 * 纯 JS，不需要编译。
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CPU_RATE_CONTROL_ENABLE = 0x1
const CPU_RATE_CONTROL_HARD_CAP = 0x4
/** JobObjectCpuRateControlInformation，见 winnt.h。 */
const INFO_CLASS_CPU_RATE = 15
const PROCESS_SET_QUOTA = 0x0100
const PROCESS_TERMINATE = 0x0001
/** CpuRate 的单位是 1/100 百分点，即 10000 = 整机 100%。 */
const RATE_MAX = 10000

/** @type {null | Record<string, any>} */
let binding = null
/** @type {any} */
let jobHandle = null
let assigned = false
/** @type {{limit: number|null, rate: number|null, at: string|null, pid: number|null, error: string|null}} */
let applied = { limit: null, rate: null, at: null, pid: null, error: null }

function requireKoffi() {
  /** @type {NodeRequire[]} */
  const roots = []
  try {
    roots.push(createRequire(import.meta.url))
  } catch {
    /* 拿不到自己的 require 就只试 profile */
  }
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh')
  const profileManifest = join(home, 'profiles', 'desktop', 'package.json')
  if (existsSync(profileManifest)) {
    try {
      roots.push(createRequire(profileManifest))
    } catch {
      /* 换下一个来源 */
    }
  }
  let lastError = null
  for (const require of roots) {
    try {
      return require('koffi')
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('koffi not found')
}

function loadBinding() {
  if (binding !== null) return binding
  try {
    const koffi = requireKoffi()
    const kernel32 = koffi.load('kernel32.dll')
    binding = {
      version: typeof koffi.version === 'string' ? koffi.version : 'koffi',
      CreateJobObjectW: kernel32.func('CreateJobObjectW', 'void *', ['void *', 'str16']),
      AssignProcessToJobObject: kernel32.func('AssignProcessToJobObject', 'bool', ['void *', 'void *']),
      SetInformationJobObject: kernel32.func('SetInformationJobObject', 'bool', ['void *', 'uint32', 'void *', 'uint32']),
      OpenProcess: kernel32.func('OpenProcess', 'void *', ['uint32', 'bool', 'uint32']),
      CloseHandle: kernel32.func('CloseHandle', 'bool', ['void *']),
      GetLastError: kernel32.func('GetLastError', 'uint32', []),
    }
    return binding
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err))
  }
}

/**
 * 把进程塞进 Job。只在第一次生效；已经塞过就跳过。
 * @param {Record<string, any>} api
 * @param {number} pid
 */
function assignProcess(api, pid) {
  const handle = api.OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, false, pid)
  if (handle === null || handle === 0) throw new Error(`OpenProcess(${pid}) 失败，GetLastError=${api.GetLastError()}`)
  try {
    if (!api.AssignProcessToJobObject(jobHandle, handle)) {
      throw new Error(`AssignProcessToJobObject 失败，GetLastError=${api.GetLastError()}`)
    }
    assigned = true
  } finally {
    api.CloseHandle(handle)
  }
}

/**
 * 设置 CPU 上限。limit 是 0–100 的整机百分比，100 表示不限制。
 * @param {number} limit
 * @param {number} [pid] 要纳入管的进程，默认本进程
 */
export function applyLimit(limit, pid = process.pid) {
  if (process.platform !== 'win32') {
    return { ok: false, reason: 'unsupported-platform', error: `硬限速只在 Windows 上有，当前 ${process.platform}` }
  }
  let api
  try {
    api = loadBinding()
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    applied = { ...applied, at: new Date().toISOString(), pid, error }
    return { ok: false, reason: 'ffi-unavailable', error }
  }

  try {
    if (jobHandle === null) {
      jobHandle = api.CreateJobObjectW(null, null)
      if (jobHandle === null || jobHandle === 0) throw new Error(`CreateJobObjectW 失败，GetLastError=${api.GetLastError()}`)
    }

    const clamped = Math.max(0, Math.min(100, Math.round(Number(limit))))
    const active = clamped < 100
    const flags = active ? CPU_RATE_CONTROL_ENABLE | CPU_RATE_CONTROL_HARD_CAP : 0
    const rate = active ? Math.max(1, Math.min(RATE_MAX, clamped * 100)) : 0

    const info = Buffer.alloc(8)
    info.writeUInt32LE(flags >>> 0, 0)
    info.writeUInt32LE(rate >>> 0, 4)
    if (!api.SetInformationJobObject(jobHandle, INFO_CLASS_CPU_RATE, info, info.length)) {
      throw new Error(`SetInformationJobObject 失败，GetLastError=${api.GetLastError()}`)
    }
    if (active && !assigned) assignProcess(api, pid)

    applied = { limit: clamped, rate: active ? rate : null, at: new Date().toISOString(), pid, error: null }
    return { ok: true, ...applied, assigned, job: jobHandle !== null }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    applied = { ...applied, at: new Date().toISOString(), pid, error }
    return { ok: false, reason: 'apply-failed', error, assigned, job: jobHandle !== null }
  }
}

/** 关掉速率控制，但保持 Job 句柄（避免进程被反复搬来搬去）。 */
export function releaseLimit() {
  try {
    const api = loadBinding()
    if (jobHandle !== null) {
      const info = Buffer.alloc(8)
      api.SetInformationJobObject(jobHandle, INFO_CLASS_CPU_RATE, info, info.length)
    }
  } catch {
    /* 后端不在就算了 */
  }
  applied = { ...applied, limit: 100, rate: null, at: new Date().toISOString(), pid: null, error: null }
}

export function backendStatus() {
  const supported = process.platform === 'win32'
  let available = false
  let version = null
  let error = null
  if (supported) {
    try {
      const api = loadBinding()
      available = true
      version = api.version
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }
  return {
    platform: process.platform,
    supported,
    available,
    version,
    error,
    job: jobHandle !== null,
    assigned,
    applied,
  }
}
