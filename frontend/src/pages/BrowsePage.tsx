import { useSearchParams } from 'react-router-dom'

/**
 * Round 3 placeholder. Round 4 browse-agent 替换为：
 *   FilterSidebar + SearchBar + NoteGrid (useInfiniteQuery) + RightRail
 */
export function BrowsePage() {
  const [params] = useSearchParams()
  const cat = params.get('cat')
  const q = params.get('q')

  return (
    <section
      data-page="browse"
      className="mx-auto max-w-6xl px-6 py-12"
    >
      <h1 className="font-serif text-2xl font-semibold text-text">浏览</h1>
      <p className="mt-2 text-sm text-text-muted">
        BrowsePage placeholder · Round 4 browse-agent 接管。
      </p>
      {(cat || q) && (
        <pre className="mt-4 rounded-md bg-bg-subtle p-3 font-mono text-xs">
          {JSON.stringify({ cat, q }, null, 2)}
        </pre>
      )}
    </section>
  )
}
