import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'

/**
 * CategoryGrid — 七大板块 4×2 网格（spec：桌面 4 列两行，移动单列）。
 * 第 8 格作为「全部笔记」CTA。
 */
export function CategoryGrid() {
  return (
    <section aria-labelledby="cats-heading" className="space-y-4">
      <header className="flex items-end justify-between">
        <h2
          id="cats-heading"
          className="font-serif text-xl font-semibold text-text"
        >
          七大板块
        </h2>
        <Link
          to="/browse"
          className="text-xs font-medium text-link hover:underline"
        >
          全部分类 →
        </Link>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.id}
              to={`/browse?cat=${c.id}`}
              data-cat={c.id}
              className="group flex h-24 items-center gap-3.5 overflow-hidden rounded-md border border-border bg-bg px-4 py-3 outline-none transition hover:bg-bg-subtle focus-visible:ring-1 focus-visible:ring-border-strong"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-md"
                style={{
                  backgroundColor: `var(${c.tagBgVar})`,
                  color: `var(${c.colorVar})`,
                }}
              >
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-text">
                  {c.label}
                </span>
                <span className="truncate text-xs text-text-muted">
                  {c.desc}
                </span>
              </span>
            </Link>
          )
        })}
        <Link
          to="/browse"
          className="group flex h-24 items-center gap-3.5 overflow-hidden rounded-md bg-bg-subtle px-4 py-3 outline-none transition hover:bg-border focus-visible:ring-1 focus-visible:ring-border-strong"
        >
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-text text-white"
          >
            <LayoutGrid size={18} strokeWidth={1.75} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text">全部笔记</span>
            <span className="text-xs text-text-muted">查看所有分类</span>
          </span>
        </Link>
      </div>
    </section>
  )
}
