import type { RollcallRecord } from '@/api/schemas/class'

/**
 * 点名名单展示辅助 —— 历史详情里缺勤优先、组内按学号稳定排序，
 * 让「谁没到」一眼可见。
 */

export function sortAbsentFirst(records: readonly RollcallRecord[]): RollcallRecord[] {
  return [...records].sort((a, b) => {
    if (a.present !== b.present) return a.present ? 1 : -1
    return a.sid.localeCompare(b.sid)
  })
}

export function countPresent(records: readonly RollcallRecord[]): number {
  return records.reduce((n, r) => n + (r.present ? 1 : 0), 0)
}

/** 缺勤名单一行摘要：「缺勤：张三、李四」；全勤返回 null。 */
export function absentSummary(records: readonly RollcallRecord[]): string | null {
  const absent = records.filter((r) => !r.present)
  if (absent.length === 0) return null
  return `缺勤：${absent.map((r) => r.nickname).join('、')}`
}
