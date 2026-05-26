/**
 * 截稿状态推导 + 领域查表。搬自设计稿 conferences.html 的 helpers，
 * 唯一区别：TODAY 取**运行时当天**（设计稿写死 2026-05-26），所以页面
 * 每天打开都按当天重新分档。
 */
import { CCF_FIELDS } from './data'
import type { CcfField, ConfStatus, Conference, FieldId } from './types'

const DAY_MS = 86_400_000

/** 当天 12:00 的时间戳——与设计稿 `new Date('...T12:00:00')` 语义一致。 */
function todayRef(): number {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0).getTime()
}

/** 截稿日（取当日 23:59:59）距今天数，向上取整；无 deadline 返回 null。 */
export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  const dl = new Date(`${deadline}T23:59:59`).getTime()
  return Math.ceil((dl - todayRef()) / DAY_MS)
}

export function classify(conf: Pick<Conference, 'deadline'>): ConfStatus {
  const d = daysUntil(conf.deadline)
  if (d == null) return 'tbd'
  if (d < 0) return 'closed'
  if (d <= 30) return 'soon'
  return 'open'
}

export function fmtDeadlineWord(deadline: string | null): string {
  const d = daysUntil(deadline)
  if (d == null) return ''
  if (d < 0) return `已截止 ${-d} 天`
  if (d === 0) return '今日截稿'
  if (d <= 30) return `还剩 ${d} 天`
  return `${d} 天后截稿`
}

/** 进度条填充百分比：越临近截稿越满；已截止=100；>180 天=5。 */
export function progressForBar(deadline: string | null): number {
  const d = daysUntil(deadline)
  if (d == null) return 0
  if (d < 0) return 100
  if (d > 180) return 5
  return Math.max(5, Math.min(100, 100 - (d / 180) * 95))
}

const FIELD_BY_ID = new Map<FieldId, CcfField>(CCF_FIELDS.map((f) => [f.id, f]))

export function fieldOf(id: FieldId): CcfField | undefined {
  return FIELD_BY_ID.get(id)
}
