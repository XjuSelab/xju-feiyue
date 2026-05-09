import { FilterSidebar } from '@/features/browse/FilterSidebar'
import { NoteGrid } from '@/features/browse/NoteGrid'
import { RightRail } from '@/features/browse/RightRail'
import { SearchBar } from '@/features/browse/SearchBar'
import { useBrowseParams } from '@/features/browse/useBrowseParams'
import { CATEGORIES } from '@/lib/categories'

/**
 * Round 4 browse-agent: 三栏 (filter sidebar / 主网格 / right rail)，
 * 顶部 SearchBar。useBrowseParams 把 cat/sort/q/tags 双向同步到 URL。
 */
export function BrowsePage() {
  const { cat, q } = useBrowseParams()
  const activeCat = cat
    ? CATEGORIES.find((c) => c.id === cat)
    : null

  return (
    <section
      data-page="browse"
      className="mx-auto max-w-7xl px-6 py-8"
    >
      <header className="mb-6 space-y-3">
        <h1 className="font-serif text-2xl font-semibold text-text">
          浏览
          {activeCat ? (
            <span
              className="ml-3 align-middle text-base font-medium text-text-muted"
              style={{ color: `var(${activeCat.colorVar})` }}
            >
              {activeCat.label}
            </span>
          ) : null}
        </h1>
        {q && (
          <p className="text-sm text-text-muted">
            搜索结果：<span className="text-text">「{q}」</span>
          </p>
        )}
        <SearchBar />
      </header>

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)_240px]">
        <FilterSidebar />
        <NoteGrid />
        <div className="hidden lg:block">
          <RightRail />
        </div>
      </div>
    </section>
  )
}
