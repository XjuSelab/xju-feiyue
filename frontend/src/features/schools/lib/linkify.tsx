import type { ReactNode } from 'react'

/**
 * Turn URLs / bare domains inside a plain string into clickable links.
 *
 * Trace `detail` strings from the agent look like
 * `"iiis.tsinghua.edu.cn/yao-recruit → 2400 chars"` — a bare domain (no
 * scheme) followed by a non-URL tail. We linkify the domain/URL and leave
 * the rest as text. Matching stops at whitespace and common CJK punctuation
 * so the trailing `→ 2400 chars` (or any Chinese text) isn't swallowed.
 *
 * Bare domains get an `https://` prefix for the href. Link styling mirrors
 * the site's canonical anchor (`text-link`), inline and without an icon to
 * stay compact within a trace row.
 */
const PATTERN =
  '(https?:\\/\\/[^\\s，。、）)】]+|(?:[\\w-]+\\.)+[a-z]{2,}(?:\\/[^\\s，。、）)】]*)?)'

export function linkify(text: string): ReactNode[] {
  if (!text) return [text]
  // Split on a single capture group → odd indices are the matched links.
  const parts = text.split(new RegExp(PATTERN, 'gi'))
  return parts.map((part, i) => {
    if (!part) return null
    if (i % 2 === 1) {
      const href = /^https?:\/\//i.test(part) ? part : `https://${part}`
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-link hover:underline break-all"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}
