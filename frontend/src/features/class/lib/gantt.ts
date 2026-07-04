/**
 * 甘特图纯日期数学 —— 全部基于 `YYYY-MM-DD` 字符串 ↔ 整数天序号
 * （`Date.UTC / 86400000`）互转。
 *
 * 坑位说明：**绝不用 `new Date('YYYY-MM-DD')` 做算术** —— 该形式按 UTC 午夜
 * 解析，在 UTC+8 下 `.getDate()` 等本地读数会差一天。这里解析/格式化只走
 * `Date.UTC(y, m-1, d)` 显式构造 + `getUTC*` 读数，时区无关。
 */

const MS_PER_DAY = 86_400_000

export type DayWindow = {
  /** 窗口起始日（含）。 */
  start: string
  /** 窗口天数（≥ MIN_WINDOW_DAYS）。 */
  days: number
}

export type DayCell = {
  date: string
  dayOfMonth: number
  isWeekend: boolean
  isToday: boolean
}

export type MonthSpan = {
  /** 「2026年7月」 */
  label: string
  /** 窗口内起始列 index。 */
  startIndex: number
  /** 覆盖列数。 */
  span: number
}

export type BarGeometry = {
  /** 距窗口起点的列偏移。 */
  offset: number
  /** 占据列数（含首尾）。 */
  span: number
  /** 条的真实起点在窗口左侧之外（被裁剪）。 */
  clippedStart: boolean
  clippedEnd: boolean
}

/** `YYYY-MM-DD` → 自 epoch 起的整数天序号。 */
export function parseDayNum(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / MS_PER_DAY
}

/** 天序号 → `YYYY-MM-DD`。 */
export function formatDayNum(n: number): string {
  const t = new Date(n * MS_PER_DAY)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}

/** 日期加减 n 天。 */
export function addDays(s: string, n: number): string {
  return formatDayNum(parseDayNum(s) + n)
}

/** b - a 的天数差（同日为 0）。 */
export function diffDays(a: string, b: string): number {
  return parseDayNum(b) - parseDayNum(a)
}

/** 今天（**本地**日历日 —— 用户看到的今天）。 */
export function todayStr(): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 窗口最小宽度（天）—— 保证空/少任务时图不至于窄成一条缝。 */
export const MIN_WINDOW_DAYS = 28
/** 任务范围外的呼吸边距（天）。 */
export const WINDOW_PAD_DAYS = 3

type DateRange = { startDate: string; endDate: string }

/**
 * 由任务集合推窗口：min(起点, 今天) - 3天 .. max(终点, 今天) + 3天，
 * 不足 28 天右侧补齐。任务为空时以今天为锚。
 */
export function computeWindow(tasks: readonly DateRange[], todayS: string = todayStr()): DayWindow {
  const today = parseDayNum(todayS)
  let min = today
  let max = today
  for (const t of tasks) {
    min = Math.min(min, parseDayNum(t.startDate))
    max = Math.max(max, parseDayNum(t.endDate))
  }
  const start = min - WINDOW_PAD_DAYS
  let days = max + WINDOW_PAD_DAYS - start + 1
  if (days < MIN_WINDOW_DAYS) days = MIN_WINDOW_DAYS
  return { start: formatDayNum(start), days }
}

/** 窗口 → 逐日表头单元格。 */
export function dayCells(w: DayWindow, todayS: string = todayStr()): DayCell[] {
  const startNum = parseDayNum(w.start)
  const out: DayCell[] = []
  for (let i = 0; i < w.days; i++) {
    const n = startNum + i
    const t = new Date(n * MS_PER_DAY)
    const dow = t.getUTCDay()
    const date = formatDayNum(n)
    out.push({
      date,
      dayOfMonth: t.getUTCDate(),
      isWeekend: dow === 0 || dow === 6,
      isToday: date === todayS,
    })
  }
  return out
}

/** 窗口 → 月份表头（跨月/跨年正确分段）。 */
export function monthSpans(w: DayWindow): MonthSpan[] {
  const startNum = parseDayNum(w.start)
  const out: MonthSpan[] = []
  for (let i = 0; i < w.days; i++) {
    const t = new Date((startNum + i) * MS_PER_DAY)
    const label = `${t.getUTCFullYear()}年${t.getUTCMonth() + 1}月`
    const last = out[out.length - 1]
    if (last && last.label === label) {
      last.span += 1
    } else {
      out.push({ label, startIndex: i, span: 1 })
    }
  }
  return out
}

/**
 * 任务条几何：窗口内的列偏移与跨度（终点**含**当天，一天任务 span=1），
 * 超出窗口两侧的部分裁剪并打 clipped 标记；完全在窗口外返回 null。
 */
export function barGeometry(task: DateRange, w: DayWindow): BarGeometry | null {
  const winStart = parseDayNum(w.start)
  const winEnd = winStart + w.days - 1
  const start = parseDayNum(task.startDate)
  const end = parseDayNum(task.endDate)
  if (end < winStart || start > winEnd) return null
  const clampedStart = Math.max(start, winStart)
  const clampedEnd = Math.min(end, winEnd)
  return {
    offset: clampedStart - winStart,
    span: clampedEnd - clampedStart + 1,
    clippedStart: start < winStart,
    clippedEnd: end > winEnd,
  }
}

/** 像素位移 → 吸附天数（四舍五入，可负）。 */
export function snapDays(pxDelta: number, dayWidth: number): number {
  return Math.round(pxDelta / dayWidth)
}
