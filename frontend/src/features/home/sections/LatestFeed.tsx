import { useLatestNotes } from '@/api'
import { NoteCard } from '@/components/common/NoteCard'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'

export function LatestFeed() {
  const q = useLatestNotes()

  return (
    <section aria-labelledby="latest-heading" className="space-y-4">
      <header className="flex items-end justify-between">
        <h2
          id="latest-heading"
          className="font-serif text-xl font-semibold text-text"
        >
          最新发布
        </h2>
        <Link
          to="/browse?sort=latest"
          className="text-xs font-medium text-link hover:underline"
        >
          更多 →
        </Link>
      </header>

      {q.isPending ? (
        <LoadingSkeleton preset="card" count={3} />
      ) : q.isError ? (
        <ErrorState
          title="加载最新笔记失败"
          message={q.error.message}
          onRetry={() => q.refetch()}
        />
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="暂无笔记"
          description="第一个写笔记的人就是你。"
          action={{ label: '去写作', onClick: () => {} }}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {q.data.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
