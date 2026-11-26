# dsh-perf-control · 性能控制

简体中文 | [English](README.en.md)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）加一根 CPU 限制滑块：**设置 → 性能控制**，5–100，拖到多少，整棵 DSH 进程树就被硬限到整机 CPU 的百分之多少。100 = 不限制。

限制不是建议，是内核级的：宿主进程被塞进一个 Windows Job Object，`CpuRate` 硬上限，此后它拉起的 ffmpeg、whisper、python、渲染进程全部继承。

## 安装

```
dsh plugin --profile desktop add dsh-perf-control
```

或者从 GitHub 源码装（免构建）：

```
dsh plugin --profile desktop add github:playfox2025/dsh-perf-control
```

装完重载一次插件（或重启 DSH），设置里就多一节「性能控制」（英文界面下叫 Perf Control）。

## 用法

滑块拖到想要的上限，松手生效。两个按钮：

- **应用**：把当前值落到 Job Object。
- **恢复不限制**：相当于 100，立刻解掉上限。
- 页面同时显示后端状态：`koffi` 装了没、Job 建没建、这次落了几多 rate。

状态存在 `~/.dsh/perf-control/state.json`，宿主启动时按它落一次；最近一次落限速的结果在 `last-apply.json`，排查时先看这个。

## 机制

三层，从上到下：

1. **设置页**：客户端注册 `settings.section`，滑块 5–100。
2. **本机路由**：`/api/dsh-perf-control?action=status|apply|reset`，走 harness 自己的 `connection` 门禁（只认 loopback 同源），不是裸 HTTP。
3. **Job Object**：`lib/job.mjs` 用 [koffi](https://www.npmjs.com/package/koffi) 调 kernel32 的 `CreateJobObjectW` / `AssignProcessToJobObject` / `SetInformationJobObject`，填 `JobObjectCpuRateControlInformation`（`CpuRate` 1–10000，`ENABLE | HARD_CAP`）。不用编译，也没有原生构建步骤。

为什么这么绕：DSH 的主进程大部分时间闲着，吃满核的是它拉起的子进程，而且 bili-watch 这类插件直接 `import { spawn } from 'node:child_process'`，绕过官方 `subprocess` 服务。所以不去逐个接管 spawn，直接把宿主塞进 Job，子进程自然继承上限。

下限是 5%：再低整个树（包括界面）就转不动了。滑块、宿主 `parseLimit`、状态文件回读三处都夹到 5，写进去的 1 也会被抬到 5。

## 实测

`scripts/probe-throttle.mjs`：12 核机器，同一段忙循环不设限跑 2 秒吃 2.02 秒 CPU；设成 3% 上限后只吃 0.86 秒（3.6% 整机），限速是真的在压。

`scripts/smoke-client.mjs`：客户端 bundle 冒烟，覆盖「没 locale」「英文」「中文」三种环境，验证插槽注册、`label` 取值与整页渲染都不炸。

## 限制与已知坑

1. **对已经在跑的进程不生效**。Job 只覆盖接管之后新生的子进程；已经启动的 ffmpeg 要等它退出。
2. **上限管整棵树**，包括界面渲染进程，拉到 25% 会让 UI 也一起慢。
3. **只在 Windows 上有硬限速**。别的平台返回 `unsupported-platform`，滑块只存设置。要跨平台得走 cgroup / nice 另一套。
4. **koffi 没装时后端显示「未就绪」**。它是 optionalDependency，`npm install` 会带上；手装（比如本地链接）要自己 `npm i koffi`。加载器先找插件自己的 `node_modules/koffi`，再找 profile 的。
5. **管不到外部浏览器**：用系统浏览器看 B 站视频，那个播放器不在 DSH 进程树里。

## 兼容性

- Windows（硬限速本身是 Windows API）。
- DSH ≥ 0.2.1-rc.1，范围写成 `>=0.2.1-rc.1 <0.3.0-0 || >=0.2.2-rc.1`。后半段别删：semver 只让预发布版本匹配「同一 major.minor.patch 元组上带预发布标签的比较符」，`>=0.2.1-rc.1` 单写会把 0.2.2-rc.x 的宿主判成不兼容。宿主再往上升（比如 0.2.3-rc）时要再补一个分支。
- Node ≥ 22。
- 界面跟随 DSH 的语言：中文显示「性能控制」，英文显示「Perf Control」。设置页文案在 `client.js` 的 `zh` / `en` 词典里，插件卡文案在 `locale/zh.json`、`locale/en.json`。

## 开发

```
node scripts/smoke-client.mjs     # 客户端 bundle 冒烟
node scripts/probe-throttle.mjs   # 量限速（--cap 加 3% 上限对照）
```

插件本体是纯 JS，没有构建步骤；本地改完重载插件即可生效。

## 许可

MIT
