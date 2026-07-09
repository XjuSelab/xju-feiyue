import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CategoryBadge } from '@/components/common/CategoryBadge'
import type { CollectionNote } from '@/api'

type Props = {
  note: CollectionNote
  index: number
  onRemove: () => void
  disabled?: boolean
}

/** One draggable note row inside a collection. */
export function SortableEntry({ note, index, onRemove, disabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    disabled: disabled ?? false,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-md border border-border bg-bg-subtle/40 px-3 py-2',
        isDragging && 'opacity-60 shadow-sm',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-text-faint hover:text-text-muted disabled:opacity-40"
        aria-label="拖拽排序"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-text-faint">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{note.title}</p>
        <p className="truncate text-xs text-text-muted">{note.summary}</p>
      </div>
      <CategoryBadge categoryId={note.category} variant="dot" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="移出合集"
        className="shrink-0 text-text-faint hover:text-red-500"
      >
        <X size={16} aria-hidden />
      </button>
    </li>
  )
}
