import { useEffect, useState, type RefObject } from 'react'

export type SelectionInfo = {
  text: string
  offsetStart: number
  offsetEnd: number
  rect: { x: number; y: number; width: number }
}

const MIN_CHARS = 4

/**
 * Track the user's text selection inside `containerRef`. Offsets index into
 * the container's textContent stream (a TreeWalker over Node.TEXT_NODE), so
 * the same selection can be re-located by walking text nodes again later
 * (used by the future highlight-restore feature).
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
): SelectionInfo | null {
  const [info, setInfo] = useState<SelectionInfo | null>(null)

  useEffect(() => {
    const onChange = () => {
      const root = containerRef.current
      if (!root) {
        setInfo(null)
        return
      }
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setInfo(null)
        return
      }
      const range = sel.getRangeAt(0)
      const startInside = range.startContainer === root || root.contains(range.startContainer)
      const endInside = range.endContainer === root || root.contains(range.endContainer)
      if (!startInside || !endInside) {
        setInfo(null)
        return
      }
      const text = sel.toString()
      if (text.length < MIN_CHARS) {
        setInfo(null)
        return
      }

      const offsetStart = textOffsetOf(root, range.startContainer, range.startOffset)
      const offsetEnd = textOffsetOf(root, range.endContainer, range.endOffset)
      const r = range.getBoundingClientRect()
      setInfo({
        text,
        offsetStart: Math.min(offsetStart, offsetEnd),
        offsetEnd: Math.max(offsetStart, offsetEnd),
        rect: {
          x: r.left + window.scrollX,
          y: r.top + window.scrollY,
          width: r.width,
        },
      })
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [containerRef])

  return info
}

/** Distance in characters from the start of `root.textContent` to `(node, offset)`. */
function textOffsetOf(root: HTMLElement, node: Node, offset: number): number {
  let count = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let n: Node | null = walker.nextNode()
  while (n) {
    if (n === node) {
      return count + offset
    }
    count += (n as Text).data.length
    n = walker.nextNode()
  }
  // Range endpoint can land on an element node (e.g. <p>) when the user
  // selects up to the very end of a paragraph. Fall back to total length.
  return count
}
