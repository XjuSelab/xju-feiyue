import { useState, type ReactNode } from 'react'

import type { GroupFile } from '@/api/schemas/class'
import { cn } from '@/lib/cn'

import type { FileGroup } from '../../lib/groupFiles'

type Props = {
  groups: FileGroup[]
  renderRow: (file: GroupFile) => ReactNode
}

/**
 * 横向展开手风琴（卡片模式）—— 选中的类别以较大宽度列出文件，其余类别收窄
 * 成竖排文字条（只显标签 + 数量）。点击窄条即切换选中。
 *
 * 每个类别都是独立圆角框（无外层包裹容器，分组选择器已在上方，遵循单一
 * 筛选原则）。选中框与面板同底色（仅描边区分）；未选中框留白更松。选中态
 * 独立、默认第一组；组集合变化时（切换分组维度）由上层 key 重挂载重置。
 */
export function FileAccordion({ groups, renderRow }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const active = groups.find((g) => g.key === selected) ?? groups[0]

  if (groups.length === 0) return null

  return (
    <div className="flex gap-2.5">
      {groups.map((g) => {
        if (g.key === active?.key) {
          return (
            <section
              key={g.key}
              aria-label={g.label}
              className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-bg"
            >
              <header className="flex items-center gap-2 px-3 py-2.5">
                <span className="truncate text-sm font-semibold text-text">{g.label}</span>
                <span className="shrink-0 text-xs text-text-faint">{g.count} 个</span>
              </header>
              <ul className="scrollbar-notion m-0 flex max-h-72 list-none flex-col gap-0.5 overflow-auto px-2 pb-2">
                {g.files.map(renderRow)}
              </ul>
            </section>
          )
        }
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => setSelected(g.key)}
            aria-label={`展开 ${g.label}（${g.count} 个）`}
            title={`${g.label} · ${g.count} 个`}
            className={cn(
              'flex w-14 shrink-0 flex-col items-center gap-3 rounded-xl border border-border bg-bg-subtle py-4',
              'text-text-muted transition hover:border-border-strong hover:text-text',
            )}
          >
            <span className="min-h-0 flex-1 overflow-hidden text-sm font-medium tracking-wide [text-orientation:upright] [writing-mode:vertical-rl]">
              {g.label}
            </span>
            <span className="shrink-0 rounded-full bg-bg px-1.5 text-[10px] tabular-nums text-text-faint">
              {g.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
