import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Heart, MessageSquare } from 'lucide-react'
import { useNote } from '@/api'
import { CategoryBadge } from '@/components/common/CategoryBadge'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Markdown } from '@/components/common/Markdown'
import 'highlight.js/styles/github.css'

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: note, isLoading, error, refetch } = useNote(id ?? '')

  if (isLoading) {
    return (
      <section data-page="note-detail" className="mx-auto max-w-3xl px-6 py-12">
        <LoadingSkeleton preset="paragraph" count={4} />
      </section>
    )
  }

  if (error || !note) {
    return (
      <section data-page="note-detail" className="mx-auto max-w-3xl px-6 py-12">
        <ErrorState
          message={error instanceof Error ? error.message : '笔记加载失败'}
          onRetry={() => refetch()}
        />
      </section>
    )
  }

  return (
    <section data-page="note-detail" className="mx-auto max-w-3xl px-6 py-12">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-faint hover:text-text-muted"
      >
        <ArrowLeft size={14} aria-hidden /> 返回
      </Link>

      <div className="mb-3 flex items-center gap-3 text-xs text-text-faint">
        <CategoryBadge categoryId={note.category} variant="chip" />
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden /> {note.readMinutes} min
        </span>
        <span aria-hidden>·</span>
        <span>
          {new Date(note.createdAt).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>

      <h1 className="mb-3 font-serif text-3xl font-semibold leading-tight text-text">
        {note.title}
      </h1>
      <p className="mb-6 text-base leading-relaxed text-text-muted">{note.summary}</p>

      <div className="mb-8 flex items-center gap-3 border-y border-border py-3 text-sm">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-bg-subtle text-xs font-medium text-text">
          {note.author.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="text-text">{note.author.name}</span>
        <span className="ml-auto inline-flex items-center gap-4 text-xs text-text-faint">
          <span className="inline-flex items-center gap-1">
            <Heart size={12} aria-hidden /> {note.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={12} aria-hidden /> {note.comments}
          </span>
        </span>
      </div>

      {note.content ? (
        <Markdown content={note.content} />
      ) : (
        <p className="text-sm italic text-text-faint">（这篇笔记暂无正文）</p>
      )}

      {note.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6 text-xs text-text-muted">
          {note.tags.map((t) => (
            <span key={t} className="rounded-full bg-bg-subtle px-2.5 py-0.5">
              #{t}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
