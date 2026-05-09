import { Fragment, type ReactNode } from 'react'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 在 text 中高亮 query 命中段，返回 React 节点（不用 dangerouslySetInnerHTML）。
 * 大小写不敏感；query 为空时返回原文。
 */
export function highlight(text: string, query: string): ReactNode {
  const trimmed = query.trim()
  if (!trimmed) return text
  const re = new RegExp(`(${escape(trimmed)})`, 'gi')
  const parts = text.split(re)
  // String.prototype.split with capture group puts matched substrings at odd
  // indices. parts[0] is non-match (possibly ''), parts[1] is match, etc.
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded-sm bg-tag-kaggle px-0.5 text-text"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}
