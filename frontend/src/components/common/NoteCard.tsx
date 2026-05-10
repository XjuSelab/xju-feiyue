import { Link } from 'react-router-dom'
import { Heart, MessageSquare, Clock } from 'lucide-react'
import type { Note } from '@/api/schemas/note'
import { CategoryBadge } from './CategoryBadge'
import { cn } from '@/lib/cn'

type Props = {
  note: Note
  variant?: 'default' | 'compact'
  className?: string
  /** Optional renderer for the title (used by browse-agent for query highlight). */
  renderTitle?: (title: string) => React.ReactNode
  renderSummary?: (summary: string) => React.ReactNode
}

/**
 * NoteCard — home / browse 共用的笔记卡片。
 * - default: 完整三段（meta / title+summary / author）
 * - compact: 横向滚动用，只显示 cat / title / 作者+点赞，不带 summary
 */
export function NoteCard({
  note,
  variant = 'default',
  className,
  renderTitle,
  renderSummary,
}: Props) {
  const compact = variant === 'compact'
  return (
    <Link
      to={`/note/${note.id}`}
      data-cat={note.category}
      className={cn(
        'group flex h-full flex-col rounded-md border border-border bg-bg p-4 outline-none transition hover:bg-bg-subtle focus-visible:ring-1 focus-visible:ring-border-strong',
        compact && 'w-72 shrink-0',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-text-faint">
        <CategoryBadge categoryId={note.category} variant="chip" />
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden /> {note.readMinutes} min
        </span>
      </div>
      <h3
        className={cn(
          'mb-1 font-serif font-semibold leading-snug text-text line-clamp-2',
          compact ? 'min-h-[2.75rem] text-base' : 'min-h-[3.1rem] text-lg',
        )}
      >
        {renderTitle ? renderTitle(note.title) : note.title}
      </h3>
      {!compact && (
        <p className="mb-3 line-clamp-2 min-h-[2.86rem] text-sm leading-relaxed text-text-muted">
          {renderSummary ? renderSummary(note.summary) : note.summary}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between text-xs text-text-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-bg-subtle text-[10px] font-medium text-text">
            {note.author.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="text-text-muted">{note.author.name}</span>
          <span aria-hidden>·</span>
          <span>{formatRelative(note.createdAt)}</span>
        </span>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Heart size={12} aria-hidden /> {note.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={12} aria-hidden /> {note.comments}
          </span>
        </span>
      </div>
    </Link>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const day = 86_400_000
  const hour = 3_600_000
  const min = 60_000
  if (diffMs < min) return '刚刚'
  if (diffMs < hour) return `${Math.floor(diffMs / min)} 分钟前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}
