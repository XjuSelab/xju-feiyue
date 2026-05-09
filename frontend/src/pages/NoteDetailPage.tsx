import { useParams } from 'react-router-dom'

/**
 * Round 3 placeholder. Round 4+ note detail（spec 未列入 R4，按 R5 排期）。
 */
export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <section
      data-page="note-detail"
      className="mx-auto max-w-3xl px-6 py-12"
    >
      <h1 className="font-serif text-2xl font-semibold text-text">
        笔记详情
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        NoteDetailPage placeholder · 笔记 id：{id ?? '(missing)'}
      </p>
    </section>
  )
}
