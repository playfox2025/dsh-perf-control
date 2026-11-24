# dsh-perf-control

[简体中文](README.md) | English

A CPU throttle slider for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): open **Settings → Perf Control**, drag between 5 and 100, and the whole DSH process tree is hard-capped at that share of total machine CPU. 100 means no limit.

The cap is kernel-level, not advisory: the host process is put into a Windows Job Object with a `CpuRate` hard cap, and every child it spawns — ffmpeg, whisper, python, renderers — inherits it.

## Install

```
dsh plugin --profile desktop add dsh-perf-control
```

Or straight from GitHub source (no build step):

```
dsh plugin --profile desktop add github:playfox2025/dsh-perf-control
```

Reload the plugin once (or restart DSH); Settings then has a "Perf Control" section (「性能控制」 in a Chinese UI).

## Usage

Drag the slider and release to apply. Two buttons:

- **Apply**: push the current value into the Job Object.
- **Reset to unlimited**: same as 100, drops the cap immediately.
- The page also reports backend state: whether `koffi` is installed, whether the job exists, and which rate was applied last time.

The value is stored in `~/.dsh/perf-control/state.json` and re-applied when the host boots; the most recent apply result is in `last-apply.json`, which is the first thing to check when debugging.

## How it works

Three layers, top to bottom:

1. **Settings page**: registers a `settings.section` with a 5–100 slider.
2. **Local route**: `/api/dsh-perf-control?action=status|apply|reset`, behind the harness's own `connection` gate (loopback same-origin only), not a bare HTTP endpoint.
3. **Job Object**: `lib/job.mjs` uses [koffi](https://www.npmjs.com/package/koffi) to call kernel32's `CreateJobObjectW` / `AssignProcessToJobObject` / `SetInformationJobObject` with `JobObjectCpuRateControlInformation` (`CpuRate` 1–10000, `ENABLE | HARD_CAP`). No compilation, no native build step.

Why the detour: DSH's main process idles most of the time; the cores are eaten by the children it spawns. Plugins like bili-watch call `import { spawn } from 'node:child_process'` directly and bypass the official `subprocess` service, so instead of intercepting every spawn we put the host into a Job and let children inherit the cap.

The floor is 5%: below that the whole tree (UI included) stops moving. The slider, the host's `parseLimit`, and the state-file readback all clamp to 5, so writing 1 still ends up as 5.

## Measured

`scripts/probe-throttle.mjs`: on a 12-core box the same busy loop burns 2.02 s of CPU in 2 s of wall time without a cap; with a 3% cap it burns only 0.86 s (3.6% of the machine). The cap really bites.

`scripts/smoke-client.mjs`: client bundle smoke test across three environments — no locale, English, Chinese — checking slot registration, the `label` value, and that the page renders.

## Limits and pitfalls

1. **Does not affect processes already running.** The job only covers children created after it is set up; an ffmpeg that is already running has to exit first.
2. **The cap covers the whole tree**, UI renderer included; dragging to 25% makes the UI slow too.
3. **Hard rate limiting is Windows-only.** Other platforms return `unsupported-platform` and the slider only stores its value. Cross-platform would need cgroup / nice instead.
4. **Without koffi the backend shows "not ready".** It's an optionalDependency and `npm install` brings it in; if you installed by hand (a local link, say) run `npm i koffi` yourself. The loader looks in the plugin's own `node_modules/koffi` first, then in the profile's.
5. **External browsers are out of reach**: watching Bilibili in your system browser puts that player outside the DSH process tree.

## Compatibility

- Windows (the hard cap itself is a Windows API).
- DSH ≥ 0.2.1-rc.1 (`engines.dsh`).
- Node ≥ 22.
- The UI follows the DSH language: "Perf Control" in English, 「性能控制」 in Chinese. Page strings live in the `zh` / `en` dictionaries in `client.js`; card text lives in `locale/zh.json` and `locale/en.json`.

## Development

```
node scripts/smoke-client.mjs     # client bundle smoke test
node scripts/probe-throttle.mjs   # measure the cap (--cap compares against 3%)
```

The plugin is plain JS with no build step; edit and reload the plugin to see changes.

## License

MIT
