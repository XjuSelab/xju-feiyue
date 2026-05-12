import { useEffect, useRef, useState } from 'react'
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
        <h2 id="hot-heading" className="font-serif text-xl font-semibold text-text">
          本周热门
        </h2>
        <Flame size={16} aria-hidden className="text-cat-research" strokeWidth={1.75} />
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
        <HotRow notes={q.data} />
      )}
    </section>
  )
}

function HotRow({ notes }: { notes: ReturnType<typeof useHotNotes>['data'] & object }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      // snap-mandatory parks scrollLeft at a snap point, so it can stop tens
      // of pixels short of scrollWidth even when the last card is fully on
      // screen. Use the actual first/last item bounds vs the viewport so the
      // fade only shows when something is genuinely clipped.
      const items = el.querySelectorAll('[role="listitem"]')
      const first = items[0] as HTMLElement | undefined
      const last = items[items.length - 1] as HTMLElement | undefined
      if (!first || !last) {
        setEdges({ left: false, right: false })
        return
      }
      const viewport = el.getBoundingClientRect()
      const left = first.getBoundingClientRect().left < viewport.left - 4
      const right = last.getBoundingClientRect().right > viewport.right + 4
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [notes])

  return (
    <div className="relative">
      <div
        ref={ref}
        role="list"
        aria-label="本周热门笔记"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:hidden"
      >
        {notes.map((note) => (
          <div role="listitem" key={note.id} className="snap-start">
            <NoteCard note={note} variant="compact" />
          </div>
        ))}
      </div>
      <div
        aria-hidden
        style={{
          backgroundImage: 'linear-gradient(to right, var(--color-bg), rgba(255,255,255,0))',
        }}
        className={`pointer-events-none absolute inset-y-0 left-0 w-16 transition-opacity duration-200 ${
          edges.left ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden
        style={{
          backgroundImage: 'linear-gradient(to left, var(--color-bg), rgba(255,255,255,0))',
        }}
        className={`pointer-events-none absolute inset-y-0 right-0 w-16 transition-opacity duration-200 ${
          edges.right ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
