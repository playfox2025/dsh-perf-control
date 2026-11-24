window.__ModuleLoader__.load({
  id: 'dsh-perf-control',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const API = '/api/dsh-perf-control'
    const NS = 'settings.perfControl'

    const CSS = `
.dpc-root{display:flex;flex-direction:column;gap:18px;max-width:760px;padding:4px 2px 24px;color:inherit}
.dpc-lead{font-size:13px;line-height:1.6;opacity:.72;margin:0}
.dpc-card{border:1px solid rgba(127,127,127,.26);border-radius:14px;padding:18px 18px 16px;background:rgba(127,127,127,.06)}
.dpc-headline{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.dpc-value{font-size:34px;font-weight:750;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:.4px}
.dpc-value small{font-size:15px;font-weight:600;opacity:.7;margin-left:2px}
.dpc-tier{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;border:1px solid rgba(127,127,127,.32);opacity:.85}
.dpc-tier[data-key="hard"]{color:#E0603C;border-color:rgba(224,96,60,.5)}
.dpc-tier[data-key="medium"]{color:#D89B2A;border-color:rgba(216,155,42,.5)}
.dpc-tier[data-key="off"]{color:#3FA97A;border-color:rgba(63,169,122,.5)}
.dpc-slider{width:100%;margin:16px 0 6px;accent-color:#4D6BFE;cursor:pointer}
.dpc-scale{display:flex;justify-content:space-between;font-size:11px;opacity:.55;font-variant-numeric:tabular-nums}
.dpc-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;align-items:center}
.dpc-btn{border:0;border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;background:#4D6BFE;color:#fff}
.dpc-btn:hover{background:#6E87FF}
.dpc-btn[disabled]{background:rgba(127,127,127,.28);color:rgba(127,127,127,.9);cursor:default}
.dpc-btn.ghost{background:rgba(127,127,127,.14);color:inherit}
.dpc-btn.ghost:hover{background:rgba(127,127,127,.24)}
.dpc-note{font-size:12px;line-height:1.6;opacity:.7}
.dpc-rows{display:flex;flex-direction:column;gap:7px;font-size:12px;line-height:1.5}
.dpc-row{display:flex;gap:10px}
.dpc-key{flex:none;width:92px;opacity:.55}
.dpc-val{flex:1;min-width:0;word-break:break-all;font-variant-numeric:tabular-nums}
.dpc-warn{border:1px solid rgba(224,96,60,.45);background:rgba(224,96,60,.1);border-radius:10px;padding:11px 13px;font-size:12px;line-height:1.65}
.dpc-warn code{font-size:11.5px;background:rgba(127,127,127,.2);padding:1px 5px;border-radius:4px}
.dpc-err{color:#E0603C}
`

    const zh = {
      nav: '性能控制',
      lead: '给 DSH 整棵进程树设一个 CPU 上限。看 B 站抽帧、whisper 转写、python 这些活都是 DSH 拉起来的子进程，一起算在这根线里。100% 等于放开。',
      'tier.off': '不限制',
      'tier.light': '轻度',
      'tier.normal': '轻度偏中',
      'tier.medium': '中度',
      'tier.hard': '严格',
      'live.prefix': '正在生效',
      'btn.apply': '应用',
      'btn.applying': '应用中…',
      'btn.reset': '恢复不限制',
      'note.applied': '已应用',
      'note.savedOnly': '设置已存下，但限速没生效',
      'note.reset': '已恢复不限制',
      'warn.title': '硬限速后端还没就绪：koffi 没装上，现在只会存设置，不会真的压 CPU。',
      'warn.installPre': '装一下就行：',
      'warn.installPost': '（或者在插件目录里装），然后重启 DSH。',
      'row.platform': '平台',
      'row.backend': '后端',
      'row.job': 'Job',
      'row.cap': '已生效上限',
      'row.state': '状态文件',
      'val.loading': '读取中…',
      'val.windowsOnly': '（只支持 Windows 硬限速）',
      'val.notReady': '未就绪',
      'val.jobAssigned': '已接管本进程树',
      'val.jobCreated': '已建，未接管',
      'val.jobNone': '未建',
      'val.unlimited': '不限制',
      footer: '两点限制先说清楚：滑块对已经在跑的进程不生效（Job 是接管之后新生的才继承）；这个上限管的是整棵树，包括界面进程，别一上来拉到 25%。',
    }

    const en = {
      nav: 'Perf Control',
      lead: 'Puts a CPU ceiling on the whole DSH process tree. Frame grabbing, whisper transcription and python jobs are all children DSH spawns, so they share this one budget. 100% means no limit.',
      'tier.off': 'Unlimited',
      'tier.light': 'Light',
      'tier.normal': 'Light–medium',
      'tier.medium': 'Medium',
      'tier.hard': 'Strict',
      'live.prefix': 'Active now',
      'btn.apply': 'Apply',
      'btn.applying': 'Applying…',
      'btn.reset': 'Remove limit',
      'note.applied': 'Applied',
      'note.savedOnly': 'Saved, but the cap did not take effect',
      'note.reset': 'Limit removed',
      'warn.title': 'The hard-cap backend is not ready: koffi is missing, so the slider only stores its value and never throttles anything.',
      'warn.installPre': 'Install it with',
      'warn.installPost': '(or inside the plugin folder), then restart DSH.',
      'row.platform': 'Platform',
      'row.backend': 'Backend',
      'row.job': 'Job',
      'row.cap': 'Active cap',
      'row.state': 'State file',
      'val.loading': 'Loading…',
      'val.windowsOnly': ' (Windows-only hard cap)',
      'val.notReady': 'Not ready',
      'val.jobAssigned': 'Attached to this process tree',
      'val.jobCreated': 'Created, not attached',
      'val.jobNone': 'Not created',
      'val.unlimited': 'Unlimited',
      footer: 'Two caveats: the slider does nothing for processes that are already running (only children spawned after the job takes over inherit it), and the cap covers the whole tree including the UI, so do not drag it to 25% right away.',
    }

    function systemFallback() {
      const lang = typeof navigator === 'object' && navigator !== null ? String(navigator.language ?? '') : ''
      return lang.toLowerCase().startsWith('zh') ? zh : en
    }

    /** 有 locale 服务就跟着 DSH 的界面语言走，没有就按浏览器语言挑一份。 */
    function makeTranslator(locale) {
      const fallback = systemFallback()
      if (locale === undefined || locale === null || typeof locale.bind !== 'function') {
        return (key) => fallback[key] ?? key
      }
      const bound = locale.bind(NS)
      return (key) => {
        const got = bound(key)
        if (typeof got !== 'string' || got === '' || got === key) return fallback[key] ?? key
        return got
      }
    }

    function tierOf(limit, t) {
      if (limit >= 100) return { key: 'off', label: t('tier.off') }
      if (limit > 75) return { key: 'light', label: t('tier.light') }
      if (limit > 50) return { key: 'normal', label: t('tier.normal') }
      if (limit > 25) return { key: 'medium', label: t('tier.medium') }
      return { key: 'hard', label: t('tier.hard') }
    }

    // 下限 5%：再往下压，DSH 自己都要转不动了。
    const MIN_LIMIT = 5

    function clampLimit(value) {
      const n = Math.round(Number(value))
      if (!Number.isFinite(n)) return 100
      return Math.min(100, Math.max(MIN_LIMIT, n))
    }

    async function readStatus() {
      const response = await fetch(`${API}?action=status`, { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
      return body
    }

    async function postAction(action, payload) {
      const response = await fetch(`${API}?action=${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
      return body
    }

    function Row(props) {
      return h('div', { className: 'dpc-row' }, h('span', { className: 'dpc-key' }, props.name), h('span', { className: 'dpc-val' }, props.value))
    }

    function PerfControlSection(props) {
      const locale = props.locale
      const [status, setStatus] = React.useState(null)
      const [limit, setLimit] = React.useState(100)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [note, setNote] = React.useState(null)
      const [, bump] = React.useState(0)

      React.useEffect(() => {
        if (locale === undefined || locale === null || typeof locale.subscribe !== 'function') return undefined
        let off
        try {
          off = locale.subscribe(() => bump((n) => (n + 1) % 100000))
        } catch {
          return undefined
        }
        return typeof off === 'function' ? off : undefined
      }, [locale])

      const t = React.useMemo(() => makeTranslator(locale), [locale])

      React.useEffect(() => {
        let alive = true
        readStatus()
          .then((next) => {
            if (!alive) return
            setStatus(next)
            setLimit(clampLimit(next.limit))
          })
          .catch((err) => alive && setError(err.message ?? String(err)))
        return () => {
          alive = false
        }
      }, [])

      const commit = React.useCallback(
        async (raw) => {
          const next = clampLimit(raw)
          const tt = makeTranslator(locale)
          setLimit(next)
          setBusy(true)
          setError(null)
          setNote(null)
          try {
            const body = await postAction('apply', { limit: next })
            setStatus(body)
            setLimit(body.limit)
            const outcome = body.outcome
            const tier = tierOf(body.limit, tt)
            if (outcome && outcome.ok === false) {
              setNote(`${tt('note.savedOnly')}: ${outcome.error ?? outcome.reason}`)
            } else {
              setNote(`${tt('note.applied')}: ${tier.label} (${body.limit}%)`)
            }
          } catch (err) {
            setError(err.message ?? String(err))
          } finally {
            setBusy(false)
          }
        },
        [locale],
      )

      const reset = React.useCallback(async () => {
        setBusy(true)
        setError(null)
        try {
          const body = await postAction('reset')
          setStatus(body)
          setLimit(body.limit)
          setNote(makeTranslator(locale)('note.reset'))
        } catch (err) {
          setError(err.message ?? String(err))
        } finally {
          setBusy(false)
        }
      }, [locale])

      const backend = status?.backend
      const tier = tierOf(limit, t)
      const appliedRate = status?.backend?.applied?.rate
      const loading = t('val.loading')

      return h(
        'div',
        { className: 'dpc-root' },
        h('p', { className: 'dpc-lead' }, t('lead')),

        h(
          'div',
          { className: 'dpc-card' },
          h(
            'div',
            { className: 'dpc-headline' },
            h('span', { className: 'dpc-value' }, String(limit), h('small', null, '%')),
            h('span', { className: 'dpc-tier', 'data-key': tier.key }, tier.label),
            appliedRate !== null && appliedRate !== undefined
              ? h('span', { className: 'dpc-note' }, `${t('live.prefix')}: ${appliedRate / 100}%`)
              : null,
          ),
          h('input', {
            className: 'dpc-slider',
            type: 'range',
            min: 5,
            max: 100,
            step: 1,
            value: limit,
            disabled: busy,
            onChange: (event) => setLimit(Number(event.target.value)),
            onPointerUp: () => commit(limit),
            onKeyUp: () => commit(limit),
            onBlur: () => commit(limit),
          }),
          h('div', { className: 'dpc-scale' }, h('span', null, '5%'), h('span', null, '25%'), h('span', null, '50%'), h('span', null, '75%'), h('span', null, '100%')),
          h(
            'div',
            { className: 'dpc-actions' },
            h('button', { className: 'dpc-btn', disabled: busy, onClick: () => commit(limit) }, busy ? t('btn.applying') : t('btn.apply')),
            h('button', { className: 'dpc-btn ghost', disabled: busy, onClick: reset }, t('btn.reset')),
            note !== null ? h('span', { className: 'dpc-note' }, note) : null,
            error !== null ? h('span', { className: 'dpc-note dpc-err' }, error) : null,
          ),
        ),

        backend !== undefined && backend.available === false
          ? h(
              'div',
              { className: 'dpc-warn' },
              h('div', null, t('warn.title')),
              h('div', null, t('warn.installPre'), ' ', h('code', null, 'npm i koffi'), ' ', t('warn.installPost')),
              backend.error !== null && backend.error !== undefined ? h('div', { className: 'dpc-err' }, backend.error) : null,
            )
          : null,

        h(
          'div',
          { className: 'dpc-card' },
          h(
            'div',
            { className: 'dpc-rows' },
            h(Row, {
              name: t('row.platform'),
              value: backend === undefined ? loading : `${backend.platform}${backend.supported ? '' : t('val.windowsOnly')}`,
            }),
            h(Row, {
              name: t('row.backend'),
              value: backend === undefined ? loading : backend.available ? `koffi ${backend.version ?? ''}` : t('val.notReady'),
            }),
            h(Row, {
              name: t('row.job'),
              value:
                backend === undefined
                  ? loading
                  : backend.job
                    ? backend.assigned
                      ? t('val.jobAssigned')
                      : t('val.jobCreated')
                    : t('val.jobNone'),
            }),
            h(Row, {
              name: t('row.cap'),
              value: appliedRate === null || appliedRate === undefined ? t('val.unlimited') : `${appliedRate / 100}%`,
            }),
            h(Row, { name: t('row.state'), value: status?.stateFile ?? loading }),
          ),
        ),

        h('p', { className: 'dpc-lead' }, t('footer')),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined

        if (locale !== undefined && locale !== null && typeof locale.register === 'function') {
          ctx.effect(
            () => locale.register(NS, { zh, en }),
            'dsh-perf-control: dictionaries',
          )
        }

        ctx.effect(
          function () {
            const style = document.createElement('style')
            style.setAttribute('data-plugin', 'dsh-perf-control')
            style.textContent = CSS
            document.head.appendChild(style)
            return function () {
              style.remove()
            }
          },
          'dsh-perf-control: styles',
        )

        const Section = (props) => h(PerfControlSection, { ...props, locale })

        try {
          ctx.slots.inject('settings.section', function () {
            return ctx.slots.register(
              {
                name: 'settings.section',
                id: 'perf-control',
                order: 26,
                label: () => makeTranslator(locale)('nav'),
              },
              Section,
            )
          })
        } catch (err) {
          /* 没有设置页插槽就什么也不做 */
        }
      },
    }
  },
})
