/**
 * 班委职务 → 徽标色调。走系统 token（见 CommitteeBadge）：
 * 班长 / 团支书 → 红（cat-research）；其余职务（含通用「班委」）→ 橙（cat-course）。
 */

export type CommitteeTone = 'red' | 'orange'

const RED_TITLES = new Set(['班长', '团支书'])

export function committeeTone(title?: string | null): CommitteeTone {
  return title && RED_TITLES.has(title.trim()) ? 'red' : 'orange'
}
