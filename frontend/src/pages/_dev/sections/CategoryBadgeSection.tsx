import { CATEGORIES } from '@/lib/categories'
import { CategoryBadge } from '@/components/common/CategoryBadge'

export function CategoryBadgeSection() {
  return (
    <section
      data-section="category-badge"
      className="space-y-4 rounded-md border border-border p-5"
    >
      <h2 className="text-lg font-semibold">5 · CategoryBadge variants</h2>

      <div>
        <p className="mb-2 text-xs text-text-muted">dot</p>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((c) => (
            <CategoryBadge key={c.id} categoryId={c.id} variant="dot" />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-text-muted">chip</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <CategoryBadge key={c.id} categoryId={c.id} variant="chip" />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-text-muted">icon-chip</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <CategoryBadge key={c.id} categoryId={c.id} variant="icon-chip" />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-text-muted">full</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <CategoryBadge key={c.id} categoryId={c.id} variant="full" />
          ))}
        </div>
      </div>
    </section>
  )
}
