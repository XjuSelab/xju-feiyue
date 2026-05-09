import { LayoutGrid, X } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { useBrowseParams, type BrowseSort } from './useBrowseParams'

const SORT_OPTIONS: { value: BrowseSort; label: string }[] = [
  { value: 'latest', label: '最新' },
  { value: 'hot', label: '最热' },
  { value: 'liked', label: '点赞最多' },
]

export function FilterSidebar() {
  const { cat, sort, tags, setCat, setSort, toggleTag, clearAll } =
    useBrowseParams()
  const hasActive = !!cat || !!sort || tags.length > 0

  return (
    <aside aria-label="筛选" className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-faint">
          分类
        </h3>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => setCat(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition',
                !cat
                  ? 'bg-bg-subtle font-medium text-text'
                  : 'text-text-muted hover:bg-bg-subtle hover:text-text',
              )}
            >
              <LayoutGrid size={14} aria-hidden /> 全部
            </button>
          </li>
          {CATEGORIES.map((c) => {
            const Icon = c.icon
            const active = cat === c.id
            return (
              <li key={c.id}>
                <button
                  type="button"
                  data-cat={c.id}
                  aria-pressed={active}
                  onClick={() => setCat(active ? null : c.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition',
                    active
                      ? 'bg-bg-subtle font-medium text-text'
                      : 'text-text-muted hover:bg-bg-subtle hover:text-text',
                  )}
                >
                  <Icon
                    size={14}
                    strokeWidth={1.75}
                    aria-hidden
                    style={{ color: `var(${c.colorVar})` }}
                  />
                  {c.label}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-faint">
          排序
        </h3>
        <ul className="space-y-0.5">
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.value
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSort(active ? null : opt.value)}
                  className={cn(
                    'w-full rounded-sm px-2 py-1.5 text-left text-sm transition',
                    active
                      ? 'bg-bg-subtle font-medium text-text'
                      : 'text-text-muted hover:bg-bg-subtle hover:text-text',
                  )}
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {tags.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-faint">
            标签
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 rounded-sm bg-bg-subtle px-2 py-0.5 text-xs text-text-muted transition hover:bg-border hover:text-text"
                >
                  {tag}
                  <X size={10} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasActive && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-text-muted underline-offset-2 hover:underline"
        >
          清除全部筛选
        </button>
      )}
    </aside>
  )
}
