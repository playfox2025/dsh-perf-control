// 客户端 bundle 冒烟：假 window/require/ctx，验证 factory 返回结构、插槽注册与中英文两份文案都不炸。
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function makeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
  }
}

function loadPlugin() {
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load: ({ id, factory }) => {
          const module = factory((name) => {
            if (name === 'react') return makeReact()
            throw new Error(`unexpected require ${name}`)
          })
          sandbox.__plugin = { id, module }
        },
      },
    },
    document: {
      createElement: () => ({ setAttribute() {}, remove() {}, textContent: '' }),
      head: { appendChild: () => {} },
    },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox.__plugin
}

// 展开函数组件，拿到真正的 DOM 节点
function resolve(node, depth = 0) {
  if (depth > 12 || node === null || typeof node !== 'object') return node
  if (typeof node.type === 'function') return resolve(node.type(node.props), depth + 1)
  return node
}

function textOf(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (typeof node !== 'object') return ''
  return node.children.map(textOf).join(' ')
}

function exercise(label, locale) {
  const plugin = loadPlugin()
  const dictionaries = {}
  const localeService =
    locale === undefined
      ? undefined
      : {
          register: (ns, dict) => {
            dictionaries[ns] = dict
          },
          bind: (ns) => (key) => dictionaries[ns]?.[locale]?.[key] ?? key,
          subscribe: () => () => {},
        }

  const registered = []
  const ctx = {
    get: (name) => (name === 'locale' ? localeService : undefined),
    effect: (run) => {
      run()
    },
    slots: {
      inject: (name, fn) => {
        if (name !== 'settings.section') throw new Error(`unexpected slot ${name}`)
        fn()
      },
      register: (meta, component) => {
        registered.push({ meta, component })
        return () => {}
      },
    },
  }

  plugin.module.apply(ctx)
  if (registered.length !== 1) throw new Error(`${label}: 注册了 ${registered.length} 个插槽，应为 1`)

  const [{ meta, component }] = registered
  const navLabel = typeof meta.label === 'function' ? meta.label() : meta.label
  const root = resolve(component({}))
  const rootClass = root?.props?.className ?? '(none)'
  const visible = textOf(root).replace(/\s+/g, ' ').trim()

  console.log(`[${label}] id=${meta.id} order=${meta.order} nav=${navLabel}`)
  console.log(`[${label}] root=${rootClass} text=${visible.slice(0, 90)}`)
  if (rootClass !== 'dpc-root') throw new Error(`${label}: 渲染根部不是 dpc-root`)
  return { navLabel, rootClass, visible }
}

const fallback = exercise('no-locale', undefined)
if (fallback.navLabel !== 'Perf Control') throw new Error(`fallback 标签应为英文，实际 ${fallback.navLabel}`)

const english = exercise('en', 'en')
if (english.navLabel !== 'Perf Control') throw new Error(`英文标签不对：${english.navLabel}`)

const chinese = exercise('zh', 'zh')
if (chinese.navLabel !== '性能控制') throw new Error(`中文标签不对：${chinese.navLabel}`)
if (!chinese.visible.includes('给 DSH 整棵进程树')) throw new Error('中文正文没取到')

console.log('ok: 三种语言环境都能注册与渲染')
