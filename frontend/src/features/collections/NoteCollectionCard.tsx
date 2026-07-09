import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { useNoteCollectionContext } from '@/api'

type Props = {
  noteId: string
}

/**
 * 文末「所属合集」卡片 —— 笔记被收进某个合集时显示：
 * 合集名 + 第 i/N 篇 + 上一篇/下一篇导航。未入集或加载失败时不渲染
 * （合集导航是锦上添花，不阻塞正文阅读）。
 */
export function NoteCollectionCard({ noteId }: Props) {
  const q = useNoteCollectionContext(noteId)
  const ctx = q.data
  if (!ctx) return null

  const { collection, entries, currentIndex } = ctx
  const prev = currentIndex > 0 ? entries[currentIndex - 1] : null
  const next = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null

  return (
    <nav
      aria-label="所属合集"
      className="mt-10 rounded-md border border-border bg-bg-subtle p-4 text-sm"
    >
      <div className="flex items-center gap-2 text-text-muted">
        <Layers size={14} aria-hidden />
        <span>
          收录于合集「{collection.title}」 · 第 {currentIndex + 1}/{entries.length} 篇
        </span>
      </div>
      {(prev || next) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {prev ? (
            <Link
              to={`/note/${prev.id}`}
              className="group flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 transition hover:bg-bg-subtle"
            >
              <ChevronLeft size={14} className="shrink-0 text-text-faint" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[11px] text-text-faint">上一篇</span>
                <span className="block truncate text-text group-hover:underline">
                  {prev.title}
                </span>
              </span>
            </Link>
          ) : (
            <span aria-hidden className="hidden sm:block" />
          )}
          {next && (
            <Link
              to={`/note/${next.id}`}
              className="group flex items-center justify-end gap-2 rounded-md border border-border bg-bg px-3 py-2 text-right transition hover:bg-bg-subtle"
            >
              <span className="min-w-0">
                <span className="block text-[11px] text-text-faint">下一篇</span>
                <span className="block truncate text-text group-hover:underline">
                  {next.title}
                </span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-text-faint" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
