import { diff_match_patch } from 'diff-match-patch'
import type { DiffSegment } from '@/api/schemas/ai'

/**
 * diff-match-patch 默认是 char-level；调用 diff_cleanupSemantic 把字符级
 * 合并成可读的语义块，对中文（每字符独立）和英文（自然词）都得到合理粒度。
 */

const DIFF_DELETE = -1
const DIFF_INSERT = 1

const dmp = new diff_match_patch()

export function computeDiff(before: string, after: string): DiffSegment[] {
  const diffs = dmp.diff_main(before, after)
  dmp.diff_cleanupSemantic(diffs)
  return diffs.map(([op, text]) => ({
    type:
      op === DIFF_INSERT ? 'add' : op === DIFF_DELETE ? 'del' : 'equal',
    text,
  }))
}

/** 把 diff segments 里的 add/equal 还原为 after 文本（拒绝 del 段）。 */
export function applyAccept(segments: DiffSegment[]): string {
  return segments
    .filter((s) => s.type !== 'del')
    .map((s) => s.text)
    .join('')
}

/** 反向：保留 equal/del → before 文本（拒绝所有 add）。 */
export function applyReject(segments: DiffSegment[]): string {
  return segments
    .filter((s) => s.type !== 'add')
    .map((s) => s.text)
    .join('')
}
