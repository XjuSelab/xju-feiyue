import { useEffect, useMemo, useRef } from 'react'
import { Inbox } from 'lucide-react'
import { useNotes } from '@/api'
import { NoteCard } from '@/components/common/NoteCard'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { highlight } from '@/lib/highlight'
import type { ListNotesQuery, Note } from '@/api/schemas/note'
import { useBrowseParams } from './useBrowseParams'

export function NoteGrid() {
  const { cat, sort, q, tags, toggleTag } = useBrowseParams()

  const query = useMemo(() => {
    const result: ListNotesQuery = { limit: 8 }
    if (cat) result.cat = cat
    if (sort) result.sort = sort
    if (q) result.q = q
    if (tags.length > 0) result.tags = tags
    return result
  }, [cat, sort, q, tags])

  const r = useNotes(query)

  // 简单的「滚到底自动加载」交互：sentinel 进入视口 → fetchNextPage
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && r.hasNextPage && !r.isFetchingNextPage) {
          void r.fetchNextPage()
        }
      },
      { rootMargin: '120px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [r])

  if (r.isPending) return <LoadingSkeleton preset="card" count={4} />
  if (r.isError) {
    return (
      <ErrorState
        title="加载笔记失败"
        message={r.error.message}
        onRetry={() => r.refetch()}
      />
    )
  }

  const notes = r.data.pages.flatMap((p) => p.items)
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="没有匹配的笔记"
        description={
          q || cat || tags.length > 0
            ? '试试换个关键词、移除筛选条件，或者去写一篇。'
            : '还没有笔记。'
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-3 md:grid-cols-2">
        {notes.map((note: Note) => (
          <li key={note.id}>
            <NoteCard
              note={note}
              renderTitle={(t) => highlight(t, q)}
              renderSummary={(s) => highlight(s, q)}
            />
            {note.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                {note.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="rounded-sm bg-bg-subtle px-1.5 py-0.5 text-[11px] text-text-muted transition hover:bg-border hover:text-text"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} className="flex justify-center pt-2">
        {r.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void r.fetchNextPage()}
            disabled={r.isFetchingNextPage}
          >
            {r.isFetchingNextPage ? '加载中…' : '加载更多'}
          </Button>
        ) : (
          <p className="text-xs text-text-faint">已经到底了 · {notes.length} 条</p>
        )}
      </div>
    </div>
  )
}
