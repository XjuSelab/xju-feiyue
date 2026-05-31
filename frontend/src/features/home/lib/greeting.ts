/**
 * 首页问候的纯前端工具集（与后端 services/greeting.py 同款规则）。
 *
 * 目标：首屏零空窗、永不闪「Hi 昵称」——
 *  - familiarName：把合法名变成亲切称呼（间隔号 / 长度规则，移植自后端）。
 *  - 时段本地兜底文案：随机从「当前时段 6 条 ∪ 通用 2 条」选一条，零网络。
 *  - isValidGreeting：剔除模型退化输出（单字 / 只剩称呼 / 纯标点 / 过长 / 换行）。
 *  - 缓存模块：localStorage 按 sid 存 3 条，3h TTL，回主页轮换一条。
 *
 * 文案不硬编码进本文件，统一外置在 ../data/greetings.json（7 时段各 6 条 +
 * 通用 2 条 = 44 条）。占位符是 {名字}（前端口径），与后端 _TEMPLATES 的
 * {addr} 互不影响。
 */

import greetingsRaw from '../data/greetings.json'

// ── 称呼 ───────────────────────────────────────────────────────────────

/** 连接音译名各段的间隔号变体（与后端 _NAME_DOTS 一致）。 */
const NAME_DOTS = '·‧・•∙'

/**
 * 由合法名推导亲切称呼（移植自后端 familiar_name）：
 *  - 音译名（含间隔号）：取第一段。
 *  - 两字名：整名。
 *  - 三字及以上：去掉姓，保留末两字。
 *  - 空 / 未知：中性称呼「同学」。
 * 注意：传入的是 User.name（合法名），不是 nickname。
 */
export function familiarName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return '同学'
  for (const d of NAME_DOTS) {
    if (n.includes(d)) {
      const head = n.split(d, 1)[0]?.trim() ?? ''
      if (head) return head
    }
  }
  const cps = Array.from(n)
  return cps.length <= 2 ? n : cps.slice(-2).join('')
}

// ── 时段与文案 ─────────────────────────────────────────────────────────

export type Period = '凌晨' | '早晨' | '上午' | '中午' | '下午' | '晚上' | '深夜'

/**
 * 小时 → 时段（全覆盖 0-23、无重叠；与后端 _period 一致）。
 * 深夜 = 22-23 两小时，晚上 = 18-21，与后端 buckets 对齐。
 */
export function periodOf(h: number): Period {
  if (h >= 5 && h < 8) return '早晨'
  if (h >= 8 && h < 11) return '上午'
  if (h >= 11 && h < 13) return '中午'
  if (h >= 13 && h < 18) return '下午'
  if (h >= 18 && h < 22) return '晚上'
  if (h >= 22) return '深夜' // 22, 23
  return '凌晨' // 0 <= h < 5
}

/**
 * 外置问候池：7 时段各 6 条 + 通用 2 条 = 44 条。
 * 每条含 {名字} 占位，timeFallback 时即时替换为称呼。
 */
const GREETINGS = greetingsRaw as Record<string, string[]>

/** 通用（无时段）问候，并入每个时段的随机池。 */
const COMMON_KEY = '通用'

/** 最简固定兜底——理论上不会触达（池恒非空），仅防 JSON 异常。 */
const HARD_FALLBACK = '{名字}，见到你真好，今天也慢慢来呀。'

/**
 * 当前 Asia/Shanghai 小时(0-23)。站点固定 locale（乌鲁木齐, UTC+8）且后端 _period
 * 也按 Asia/Shanghai，这里统一用沪时——避免海外浏览器本地时区导致前端兜底时段与
 * 后端生成/缓存的时段不一致。Intl 取不到时退回浏览器本地小时。
 */
function shanghaiHour(): number {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
    const h = parseInt(s, 10)
    if (Number.isFinite(h)) return h % 24 // "24"(午夜)→0
  } catch {
    /* Intl/时区不可用 → 退回本地小时 */
  }
  return new Date().getHours()
}

/**
 * 即时本地时段兜底：从「当前时段 6 条 ∪ 通用 2 条」合并池随机选一条，
 * 把 {名字} 替换成称呼。纯本地、零网络、永不空窗——首屏没有有效缓存时即用它。
 */
export function timeFallback(addr: string): string {
  const period = periodOf(shanghaiHour())
  const pool = [...(GREETINGS[period] ?? []), ...(GREETINGS[COMMON_KEY] ?? [])]
  const tpl = pool.length
    ? (pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!)
    : HARD_FALLBACK
  return tpl.replace('{名字}', addr)
}

// ── 退化校验 ───────────────────────────────────────────────────────────

export const MIN_LEN = 6
export const MAX_LEN = 40

/** 标点 + 空白集合（前后端一致），用于剥离后判断实义内容长度。 */
const PUNCT_RE = /[\s，。！？、；：…—~·,.!?;:~]+/g

/**
 * 退化校验（与后端 is_valid_greeting 同款判定）：
 *  1) 单行：含 \n / \r → 非法。
 *  2) 去引号后为空、或去标点空白后无实义字符 → 非法。
 *  3) 长度（按码点）：< 6 或 > 40 → 非法。
 *  4) 剥离称呼 + 去标点空白后实义字符 < 2 → 非法（只剩称呼）。
 */
export function isValidGreeting(text: string, addr: string): boolean {
  if (!text) return false
  const t = text.trim().replace(/^["'“”』『」「]+|["'“”』『」「]+$/g, '')
  if (t.includes('\n') || t.includes('\r')) return false
  const core = t.replace(PUNCT_RE, '')
  if (core.length === 0) return false
  const n = Array.from(t).length
  if (n < MIN_LEN || n > MAX_LEN) return false
  const rest = t.replace(addr, '').replace(PUNCT_RE, '')
  if (Array.from(rest).length < 2) return false
  return true
}

// ── 缓存与轮换 ─────────────────────────────────────────────────────────

export const TTL_MS = 3 * 60 * 60 * 1000 // 3h

type Cached = { lines: string[]; at: number; idx: number }

const cacheKey = (sid: string): string => `labnotes.greeting.${sid}`

/** 读缓存：校验形态 + TTL；过期/损坏返回 null（不删，下次写覆盖）。 */
export function readCache(sid: string): Cached | null {
  try {
    const raw = localStorage.getItem(cacheKey(sid))
    if (!raw) return null
    const c = JSON.parse(raw) as unknown
    if (!c || typeof c !== 'object') return null
    const { lines, at, idx } = c as Partial<Cached>
    if (
      !Array.isArray(lines) ||
      lines.length === 0 ||
      !lines.every((l) => typeof l === 'string') ||
      typeof at !== 'number' ||
      typeof idx !== 'number'
    ) {
      return null
    }
    if (Date.now() - at >= TTL_MS) return null
    return { lines, at, idx }
  } catch {
    return null
  }
}

/** 写缓存：重置 idx=0、刷新 at（开启新的 3h 窗口）。 */
export function writeCache(sid: string, lines: string[]): void {
  try {
    const payload: Cached = { lines, at: Date.now(), idx: 0 }
    localStorage.setItem(cacheKey(sid), JSON.stringify(payload))
  } catch {
    /* localStorage 满 / 隐私模式 — 静默；首页有 timeFallback 兜底 */
  }
}

/**
 * 轮换取一条：读有效缓存 → 取 lines[idx] → 持久化 idx+1（at 不变，保留同一 TTL 窗口）。
 * 无有效缓存返回 null。
 */
export function rotate(sid: string): string | null {
  const c = readCache(sid)
  if (!c) return null
  const line = c.lines[c.idx % c.lines.length] ?? c.lines[0]!
  const next: Cached = { ...c, idx: (c.idx + 1) % c.lines.length }
  try {
    localStorage.setItem(cacheKey(sid), JSON.stringify(next))
  } catch {
    /* 持久化失败不影响本次返回 */
  }
  return line
}
