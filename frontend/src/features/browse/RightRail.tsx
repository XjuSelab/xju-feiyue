import { useMemo } from 'react'
import { Tag, Users } from 'lucide-react'
import { useLatestNotes } from '@/api'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { useBrowseParams } from './useBrowseParams'
import { cn } from '@/lib/cn'

/**
 * RightRail — 右侧栏：热门标签 / 活跃作者 / 时间线（轻量本地聚合，
 * R5 可换成专用 endpoint）。
 */
export function RightRail() {
  const { tags: activeTags, toggleTag } = useBrowseParams()
  const r = useLatestNotes()

  const computed = useMemo(() => {
    if (!r.data) return null
    const tagFreq = new Map<string, number>()
    const authorMap = new Map<string, { id: string; name: string; count: number }>()
    const timeline = new Map<string, number>()

    for (const note of r.data) {
      for (const tag of note.tags) {
        tagFreq.set(tag, (tagFreq.get(tag) ?? 0) + 1)
      }
      const a = authorMap.get(note.author.id) ?? {
        id: note.author.id,
        name: note.author.name,
        count: 0,
      }
      a.count += 1
      authorMap.set(note.author.id, a)
      const day = note.createdAt.slice(0, 10)
      timeline.set(day, (timeline.get(day) ?? 0) + 1)
    }

    return {
      hotTags: Array.from(tagFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12),
      activeAuthors: Array.from(authorMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      timeline: Array.from(timeline.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, 7),
    }
  }, [r.data])

  if (r.isPending) {
    return (
      <aside className="space-y-6">
        <LoadingSkeleton preset="list" count={3} />
      </aside>
    )
  }
  if (!computed) return null

  return (
    <aside aria-label="侧栏聚合" className="space-y-6">
      <section>
        <RailHeader icon={Tag} label="热门标签" />
        <ul className="flex flex-wrap gap-1.5">
          {computed.hotTags.map(([tag, count]) => {
            const active = activeTags.includes(tag)
            return (
              <li key={tag}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs transition',
                    active
                      ? 'bg-text text-white'
                      : 'bg-bg-subtle text-text-muted hover:bg-border hover:text-text',
                  )}
                >
                  #{tag}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <RailHeader icon={Users} label="活跃作者" />
        <ul className="space-y-1.5">
          {computed.activeAuthors.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2 text-text-muted">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-bg-subtle text-[10px] font-medium text-text">
                  {a.name.slice(0, 2).toUpperCase()}
                </span>
                {a.name}
              </span>
              <span className="text-xs text-text-faint">{a.count} 篇</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <RailHeader label="近 7 日发布" />
        <ul className="space-y-1.5">
          {computed.timeline.map(([day, count]) => (
            <li key={day} className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-16 shrink-0 text-text-faint tabular-nums">
                {formatTimelineDay(day)}
              </span>
              <span className="flex-1 rounded-sm bg-bg-subtle">
                <span
                  className="block h-1.5 rounded-sm bg-text"
                  style={{ width: `${Math.min(100, count * 25)}%` }}
                />
              </span>
              <span className="w-4 text-right tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatTimelineDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return day
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays >= 2 && diffDays <= 6) return WEEKDAYS[date.getDay()]
  // U+2007 (figure space) matches digit width — pads single-digit M/D so
  // 4月4日 aligns column-wise with 4月10日 / 12月10日 in a tabular-nums font.
  const pad = (n: number) => (n < 10 ? `\u2007${n}` : `${n}`)
  return `${pad(m)}月${pad(d)}日`
}

function RailHeader({ icon: Icon, label }: { icon?: typeof Tag; label: string }) {
  return (
    <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-faint">
      {Icon && <Icon size={12} aria-hidden />}
      {label}
    </h3>
  )
}
