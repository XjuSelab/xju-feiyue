import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Markdown } from './Markdown'

// 链接渲染/跳转回归（见 WritePage onInsertLink + 本文件 a 渲染器）：
// - 无 scheme 但像主机名的网址要补 https:// 当外链，别误跳站内 404
// - 占位/空 href（裸 http(s):// 、url、空 ()）不该渲染成会跳 404 的死链，退化成纯文本
// - 站内锚点 / mailto / 站内绝对路径保持原样、不强开新窗口
function anchors(html: HTMLElement) {
  return [...html.querySelectorAll('a')].map((a) => ({
    text: a.textContent,
    href: a.getAttribute('href'),
    target: a.getAttribute('target'),
  }))
}

describe('Markdown link resolution', () => {
  it('prepends https:// to scheme-less hostnames and opens them in a new tab', () => {
    const { container } = render(<Markdown content="[SchemeLess](www.google.com)" />)
    expect(anchors(container)).toEqual([
      { text: 'SchemeLess', href: 'https://www.google.com', target: '_blank' },
    ])
  })

  it('prepends https:// to a bare domain with a path/query', () => {
    const { container } = render(<Markdown content="[BareWww](google.com/search?q=x)" />)
    expect(anchors(container)[0]).toMatchObject({
      href: 'https://google.com/search?q=x',
      target: '_blank',
    })
  })

  it('keeps real http(s) links as external (new tab)', () => {
    const { container } = render(<Markdown content="[Real](https://example.com)" />)
    expect(anchors(container)).toEqual([
      { text: 'Real', href: 'https://example.com', target: '_blank' },
    ])
  })

  it('renders the bare `https://` placeholder as plain text, not a dead link', () => {
    const { container } = render(<Markdown content="[BarePlaceholder](https://)" />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('BarePlaceholder')
  })

  it('renders the `url` placeholder (non-URL text) as plain text', () => {
    const { container } = render(<Markdown content="[UrlPlaceholder](url)" />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('UrlPlaceholder')
  })

  it('renders an empty `()` target as plain text', () => {
    const { container } = render(<Markdown content="[EmptyParens]()" />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('EmptyParens')
  })

  it('recovers a placeholder href when the visible text is itself a URL', () => {
    const { container } = render(<Markdown content="[https://recovered.com](url)" />)
    expect(anchors(container)).toEqual([
      { text: 'https://recovered.com', href: 'https://recovered.com', target: '_blank' },
    ])
  })

  it('keeps in-page anchors as same-tab native links', () => {
    const { container } = render(<Markdown content="[Heading](#heading)" />)
    expect(anchors(container)).toEqual([{ text: 'Heading', href: '#heading', target: null }])
  })

  it('keeps internal absolute paths as same-tab links (no new tab)', () => {
    const { container } = render(<Markdown content="[Note](/note/abc)" />)
    expect(anchors(container)).toEqual([{ text: 'Note', href: '/note/abc', target: null }])
  })

  it('keeps mailto links same-tab (not forced into a new tab)', () => {
    const { container } = render(<Markdown content="[Mail](mailto:a@b.com)" />)
    expect(anchors(container)).toEqual([{ text: 'Mail', href: 'mailto:a@b.com', target: null }])
  })
})
