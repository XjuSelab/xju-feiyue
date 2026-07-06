import { useState, type ReactNode } from 'react'

import type { GroupFile } from '@/api/schemas/class'
import { cn } from '@/lib/cn'

import type { FileGroup } from '../../lib/groupFiles'

type Props = {
  title: string
  groups: FileGroup[]
  renderRow: (file: GroupFile) => ReactNode
}

/**
 * 横向展开手风琴（卡片模式）—— 选中的组以较大宽度列出文件，其余组收窄成
 * 竖排文字条（只显示标签 + 数量）。点击窄条即切换选中。
 *
 * 「按格式」「按上传者」各用一个实例：分组本身即筛选。选中态各自独立、
 * 默认第一组；组集合变化后若原选中组不在了，回退到第一组。
 */
export function FileAccordion({ title, groups, renderRow }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const active = groups.find((g) => g.key === selected) ?? groups[0]

  if (groups.length === 0) return null

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-text-muted">{title}</div>
      <div className="flex gap-1.5 rounded-lg border border-border bg-bg p-1.5">
        {groups.map((g) => {
          const isActive = g.key === active?.key
          if (isActive) {
            return (
              <section
                key={g.key}
                aria-label={g.label}
                className="flex min-w-0 flex-1 flex-col rounded-md bg-bg-subtle"
              >
                <header className="flex items-center gap-2 px-2.5 py-2">
                  <span className="truncate text-sm font-semibold text-text">{g.label}</span>
                  <span className="shrink-0 text-xs text-text-faint">{g.count} 个</span>
                </header>
                <ul className="m-0 flex max-h-72 list-none flex-col gap-0.5 overflow-auto px-1.5 pb-1.5">
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
                'flex w-11 shrink-0 flex-col items-center gap-2 rounded-md py-3',
                'text-text-muted transition hover:bg-bg-subtle hover:text-text',
              )}
            >
              <span
                className="min-h-0 flex-1 truncate text-sm font-medium [writing-mode:vertical-rl] [text-orientation:upright]"
              >
                {g.label}
              </span>
              <span className="shrink-0 rounded-full bg-bg-subtle px-1.5 text-[10px] tabular-nums text-text-faint">
                {g.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
