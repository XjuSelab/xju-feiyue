import { useEffect } from 'react'

export type AnchorSpec = {
  commentId: string
  text: string
}

/**
 * Wrap each anchored comment's quoted text in <mark class="anchor-mark"
 * data-comment-id="…"> inside `containerRef`. Re-runs whenever the content
 * (markdown body) or anchor list changes, and tears its wraps down on
 * cleanup so the article body is left untouched.
 *
 * The match is whitespace-tolerant: rendered textContent keeps `\n` but
 * Selection.toString() collapses them to spaces, so the same anchor still
 * resolves after a save round-trip.
 *
 * Wrapping can fail when an anchor crosses inline parents (e.g. the quote
 * straddles two rehype-highlight <span class="hljs-*"> children). In that
 * case we silently skip — the comment still appears, just without an
 * article-side highlight target.
 */
export function useAnchorMarks(
  containerRef: React.RefObject<HTMLElement | null>,
  anchors: AnchorSpec[],
  deps: ReadonlyArray<unknown> = [],
) {
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    cleanup(root)
    for (const a of anchors) {
      if (!a.text) continue
      try {
        wrapAnchor(root, a)
      } catch {
        // crossed-boundary or detached nodes — skip this anchor
      }
    }
    return () => cleanup(root)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, anchors, ...deps])
}

function cleanup(root: HTMLElement) {
  const marks = root.querySelectorAll('mark.anchor-mark')
  marks.forEach((m) => {
    const parent = m.parentNode
    if (!parent) return
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    parent.removeChild(m)
  })
  root.normalize()
}

function collectTextNodes(root: HTMLElement): { nodes: Text[]; total: string } {
  // Skip text inside existing anchor-marks so re-wraps don't pick up our own
  // wrappers' content.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const el = n.parentElement
      if (el && el.closest('mark.anchor-mark')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes: Text[] = []
  let total = ''
  let n: Node | null = walker.nextNode()
  while (n) {
    nodes.push(n as Text)
    total += (n as Text).data
    n = walker.nextNode()
  }
  return { nodes, total }
}

function wrapAnchor(root: HTMLElement, anchor: AnchorSpec) {
  const { nodes, total } = collectTextNodes(root)
  let start = total.indexOf(anchor.text)
  let end = start + anchor.text.length
  if (start < 0) {
    const pattern = anchor.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const m = new RegExp(pattern).exec(total)
    if (!m) return
    start = m.index
    end = start + m[0].length
  }
  wrapRangeAcrossNodes(nodes, start, end, anchor.commentId)
}

function wrapRangeAcrossNodes(nodes: Text[], start: number, end: number, commentId: string) {
  type Seg = { node: Text; from: number; to: number }
  const segs: Seg[] = []
  let acc = 0
  for (const n of nodes) {
    const next = acc + n.data.length
    if (next <= start) {
      acc = next
      continue
    }
    if (acc >= end) break
    const from = Math.max(0, start - acc)
    const to = Math.min(n.data.length, end - acc)
    segs.push({ node: n, from, to })
    acc = next
  }
  for (const seg of segs) {
    let target: Text = seg.node
    if (seg.to < target.data.length) target.splitText(seg.to)
    if (seg.from > 0) target = target.splitText(seg.from)
    const mark = document.createElement('mark')
    mark.className = 'anchor-mark'
    mark.dataset.commentId = commentId
    const parent = target.parentNode
    if (!parent) continue
    parent.insertBefore(mark, target)
    mark.appendChild(target)
  }
}
