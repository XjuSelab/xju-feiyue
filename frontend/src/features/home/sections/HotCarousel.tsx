import { useHotNotes } from '@/api'
import { NoteCard } from '@/components/common/NoteCard'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { Flame } from 'lucide-react'

export function HotCarousel() {
  const q = useHotNotes()

  return (
    <section aria-labelledby="hot-heading" className="space-y-4">
      <header className="flex items-end gap-2">
        <h2
          id="hot-heading"
          className="font-serif text-xl font-semibold text-text"
        >
          本周热门
        </h2>
        <Flame
          size={16}
          aria-hidden
          className="text-cat-research"
          strokeWidth={1.75}
        />
      </header>

      {q.isPending ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-72 shrink-0">
              <LoadingSkeleton preset="card" count={1} />
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState
          title="加载热门笔记失败"
          message={q.error.message}
          onRetry={() => q.refetch()}
        />
      ) : q.data.length === 0 ? (
        <p className="text-sm text-text-muted">暂无热门笔记。</p>
      ) : (
        <div
          role="list"
          aria-label="本周热门笔记"
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2"
        >
          {q.data.map((note) => (
            <div role="listitem" key={note.id} className="snap-start">
              <NoteCard note={note} variant="compact" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
