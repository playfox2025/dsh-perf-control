// 硬限速实测：同一个忙循环，跑一次不设限、一次设成 3%，比 CPU 时间。
// 目的只有一个 —— 证明 Job 的 CpuRate 真的在压，不只是把参数写进去了。
import os from 'node:os'
import { applyLimit } from '../lib/job.mjs'

const cores = os.cpus().length
const seconds = 2
const capped = process.argv.includes('--cap')

function busy(ms) {
  const end = Date.now() + ms
  let acc = 0
  while (Date.now() < end) {
    for (let i = 0; i < 20000; i += 1) acc = (acc + Math.sqrt(i)) % 1000003
  }
  return acc
}

if (capped) {
  const limit = cores >= 8 ? 3 : 10
  const outcome = applyLimit(limit)
  console.log(`cap=${limit}%`, JSON.stringify(outcome))
  if (!outcome.ok) process.exit(1)
}

const before = process.cpuUsage()
busy(seconds * 1000)
const used = process.cpuUsage(before)
const cpuSeconds = (used.user + used.system) / 1e6
const share = (cpuSeconds / (seconds * cores)) * 100
console.log(`cores=${cores} wall=${seconds}s cpu=${cpuSeconds.toFixed(2)}s == ${share.toFixed(1)}% of machine`)
