// 客户端 bundle 冒烟：假 window/require/ctx，验证 factory 返回结构与插槽注册不炸。
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const registered = []
const styles = []

const fakeReact = {
  createElement: (...args) => ({ args }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
}

const sandbox = {
  window: {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        const module = factory((name) => {
          if (name === 'react') return fakeReact
          throw new Error(`unexpected require ${name}`)
        })
        globalThis.__plugin = { id, module }
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

const plugin = globalThis.__plugin
if (!plugin) throw new Error('loader 没被调用')
if (typeof plugin.module.apply !== 'function') throw new Error('缺 apply')

const ctx = {
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

if (registered.length !== 1) throw new Error(`注册了 ${registered.length} 个插槽，应为 1`)
const [{ meta, component }] = registered
console.log('id =', plugin.id)
console.log('slot =', meta.name, '| id =', meta.id, '| order =', meta.order, '| label =', meta.label)
if (typeof component !== 'function') throw new Error('组件不是函数')

// 渲染一次，确认不抛（状态读取中）
const tree = component({})
console.log('render ok, root class =', tree.args[1]?.className ?? '(none)')
