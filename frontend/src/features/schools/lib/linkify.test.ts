import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { linkify } from './linkify'

interface Anchor {
  href: string
  text: ReactNode
}

function anchors(nodes: ReactNode[]): Anchor[] {
  const out: Anchor[] = []
  for (const n of nodes) {
    if (isValidElement(n) && n.type === 'a') {
      const props = n.props as { href: string; children: ReactNode }
      out.push({ href: props.href, text: props.children })
    }
  }
  return out
}

function plainText(nodes: ReactNode[]): string {
  return nodes
    .map((n) => {
      if (typeof n === 'string') return n
      if (isValidElement(n)) return String((n.props as { children?: ReactNode }).children ?? '')
      return ''
    })
    .join('')
}

describe('linkify', () => {
  it('links a bare domain + path and prefixes https://', () => {
    const a = anchors(linkify('iiis.tsinghua.edu.cn/yao-recruit → 2400 chars'))
    expect(a).toHaveLength(1)
    expect(a[0]!.href).toBe('https://iiis.tsinghua.edu.cn/yao-recruit')
    expect(a[0]!.text).toBe('iiis.tsinghua.edu.cn/yao-recruit')
  })

  it('keeps the non-URL tail as text, not swallowed into the link', () => {
    expect(plainText(linkify('zhihu.com/q/12345 → 1800 chars'))).toBe(
      'zhihu.com/q/12345 → 1800 chars',
    )
  })

  it('keeps an explicit scheme as-is', () => {
    const a = anchors(linkify('原文 https://example.com/a/b 之后'))
    expect(a).toHaveLength(1)
    expect(a[0]!.href).toBe('https://example.com/a/b')
  })

  it('returns plain text when there is no URL', () => {
    const nodes = linkify('招生·positive·conf=0.85')
    expect(anchors(nodes)).toHaveLength(0)
    expect(plainText(nodes)).toBe('招生·positive·conf=0.85')
  })

  it('does not treat a decimal like 0.85 as a domain', () => {
    expect(anchors(linkify('conf=0.85'))).toHaveLength(0)
  })

  it('handles empty string', () => {
    expect(plainText(linkify(''))).toBe('')
  })
})
