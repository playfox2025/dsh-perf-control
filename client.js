window.__ModuleLoader__.load({
  id: 'dsh-perf-control',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const API = '/api/dsh-perf-control'

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

    function tierOf(limit) {
      if (limit >= 100) return { key: 'off', label: '不限制' }
      if (limit > 75) return { key: 'light', label: '轻度' }
      if (limit > 50) return { key: 'normal', label: '轻度偏中' }
      if (limit > 25) return { key: 'medium', label: '中度' }
      return { key: 'hard', label: '严格' }
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

    function PerfControlSection() {
      const [status, setStatus] = React.useState(null)
      const [limit, setLimit] = React.useState(100)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [note, setNote] = React.useState(null)

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

      const commit = React.useCallback(async (raw) => {
        const next = clampLimit(raw)
        setLimit(next)
        setBusy(true)
        setError(null)
        setNote(null)
        try {
          const body = await postAction('apply', { limit: next })
          setStatus(body)
          setLimit(body.limit)
          const outcome = body.outcome
          if (outcome && outcome.ok === false) {
            setNote(`设置已存下，但限速没生效：${outcome.error ?? outcome.reason}`)
          } else {
            setNote(`已应用：${body.tier.label}（${body.limit}%）`)
          }
        } catch (err) {
          setError(err.message ?? String(err))
        } finally {
          setBusy(false)
        }
      }, [])

      const reset = React.useCallback(async () => {
        setBusy(true)
        setError(null)
        try {
          const body = await postAction('reset')
          setStatus(body)
          setLimit(body.limit)
          setNote('已恢复不限制')
        } catch (err) {
          setError(err.message ?? String(err))
        } finally {
          setBusy(false)
        }
      }, [])

      const backend = status?.backend
      const tier = tierOf(limit)
      const appliedRate = status?.backend?.applied?.rate

      return h(
        'div',
        { className: 'dpc-root' },
        h(
          'p',
          { className: 'dpc-lead' },
          '给 DSH 整棵进程树设一个 CPU 上限。看 B 站抽帧、whisper 转写、python 这些活都是 DSH 拉起来的子进程，一起算在这根线里。100% 等于放开。',
        ),

        h(
          'div',
          { className: 'dpc-card' },
          h(
            'div',
            { className: 'dpc-headline' },
            h('span', { className: 'dpc-value' }, String(limit), h('small', null, '%')),
            h('span', { className: 'dpc-tier', 'data-key': tier.key }, tier.label),
            appliedRate !== null && appliedRate !== undefined ? h('span', { className: 'dpc-note' }, `正在生效：${appliedRate / 100}%`) : null,
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
            h('button', { className: 'dpc-btn', disabled: busy, onClick: () => commit(limit) }, busy ? '应用中…' : '应用'),
            h('button', { className: 'dpc-btn ghost', disabled: busy, onClick: reset }, '恢复不限制'),
            note !== null ? h('span', { className: 'dpc-note' }, note) : null,
            error !== null ? h('span', { className: 'dpc-note dpc-err' }, error) : null,
          ),
        ),

        backend !== undefined && backend.available === false
          ? h(
              'div',
              { className: 'dpc-warn' },
              h('div', null, '硬限速后端还没就绪：', h('code', null, 'koffi'), ' 没装上，现在只会存设置，不会真的压 CPU。'),
              h('div', null, '装一下就行：', h('code', null, 'pnpm add koffi'), '（或者在插件目录里装），然后重启 DSH。'),
              backend.error !== null && backend.error !== undefined ? h('div', { className: 'dpc-err' }, backend.error) : null,
            )
          : null,

        h(
          'div',
          { className: 'dpc-card' },
          h(
            'div',
            { className: 'dpc-rows' },
            h(Row, { name: '平台', value: backend === undefined ? '读取中…' : `${backend.platform}${backend.supported ? '' : '（只支持 Windows 硬限速）'}` }),
            h(Row, { name: '后端', value: backend === undefined ? '读取中…' : backend.available ? `koffi ${backend.version ?? ''}` : '未就绪' }),
            h(Row, { name: 'Job', value: backend === undefined ? '读取中…' : backend.job ? (backend.assigned ? '已接管本进程树' : '已建，未接管') : '未建' }),
            h(Row, { name: '已生效上限', value: appliedRate === null || appliedRate === undefined ? '不限制' : `${appliedRate / 100}%` }),
            h(Row, { name: '状态文件', value: status?.stateFile ?? '读取中…' }),
          ),
        ),

        h(
          'p',
          { className: 'dpc-lead' },
          '两点限制先说清楚：滑块对已经在跑的进程不生效（Job 是接管之后新生的才继承）；这个上限管的是整棵树，包括界面进程，别一上来拉到 25%。',
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
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

        try {
          ctx.slots.inject('settings.section', function () {
            return ctx.slots.register(
              {
                name: 'settings.section',
                id: 'perf-control',
                order: 26,
                label: '性能控制',
              },
              PerfControlSection,
            )
          })
        } catch (err) {
          /* 没有设置页插槽就什么也不做 */
        }
      },
    }
  },
})
