import { Link } from 'react-router-dom'
import { NotebookPen } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'

/**
 * BrandPanel — 登录页左栏。仅 lg+ 显示；移动端 LoginPage 单栏渲染。
 * 内容：logo / slogan / 7 类预览（4+3 排布）
 */
export function BrandPanel() {
  const firstRow = CATEGORIES.slice(0, 4)
  const secondRow = CATEGORIES.slice(4, 7)

  return (
    <aside
      aria-label="LabNotes 简介"
      className="hidden lg:flex lg:flex-col lg:justify-between lg:gap-12 lg:bg-bg-subtle lg:p-12"
    >
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-serif text-2xl font-semibold text-text"
        >
          <NotebookPen size={22} strokeWidth={1.75} aria-hidden />
          LabNotes
        </Link>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">
          实验室经验共享。Notion 极简白的外壳，Claude 导出 PDF 的内容质感。
          把今天的实验日志、Kaggle 复盘、读书笔记，写成下次能直接抄的作业。
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-faint">
          七大板块
        </h3>
        <div className="space-y-2">
          <CategoryRow categories={firstRow} />
          <CategoryRow categories={secondRow} />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-text-faint">
        登录后即可写作 / 收藏 / 评论；游客模式仅可浏览。
      </p>
    </aside>
  )
}

function CategoryRow({
  categories,
}: {
  categories: (typeof CATEGORIES)[number][]
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.id}
            data-cat={c.id}
            className="flex flex-col items-center gap-1.5 rounded-md border border-border bg-bg p-3"
          >
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-md"
              style={{
                backgroundColor: `var(${c.tagBgVar})`,
                color: `var(${c.colorVar})`,
              }}
            >
              <Icon size={16} strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-medium text-text-muted">
              {c.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
