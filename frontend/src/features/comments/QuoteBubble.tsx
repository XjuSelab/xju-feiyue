import { MessageCircle } from 'lucide-react'

type Props = {
  position: { x: number; y: number } | null
  onPick: () => void
}

/**
 * Floating "Comment this" button anchored above the user's current text
 * selection. Position is page-relative (x,y already include window.scrollX/Y).
 */
export function QuoteBubble({ position, onPick }: Props) {
  if (!position) return null
  return (
    <button
      type="button"
      // The selectionchange event fires before click → use mousedown to claim
      // the click without losing the selection.
      onMouseDown={(e) => {
        e.preventDefault()
        onPick()
      }}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y - 36}px`,
      }}
      className="z-50 inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-xs text-text shadow-md hover:bg-bg-subtle"
    >
      <MessageCircle size={12} aria-hidden /> 评论这段
    </button>
  )
}
