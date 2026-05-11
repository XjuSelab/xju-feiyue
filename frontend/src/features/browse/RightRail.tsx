import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Tag, Users } from 'lucide-react'
import { useLatestNotes } from '@/api'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { useBrowseParams } from './useBrowseParams'
import { cn } from '@/lib/cn'
import type { Note } from '@/api/schemas/note'

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
    const dayMap = new Map<string, Note[]>()

    for (const note of r.data) {
      for (const tag of note.tags) {
        tagFreq.set(tag, (tagFreq.get(tag) ?? 0) + 1)
      }
      const a = authorMap.get(note.author.sid) ?? {
        id: note.author.sid,
        name: note.author.nickname,
        count: 0,
      }
      a.count += 1
      authorMap.set(note.author.sid, a)
      const day = note.createdAt.slice(0, 10)
      const arr = dayMap.get(day) ?? []
      arr.push(note)
      dayMap.set(day, arr)
    }

    return {
      hotTags: Array.from(tagFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12),
      activeAuthors: Array.from(authorMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      dayGroups: capDayGroups(
        Array.from(dayMap.entries())
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([day, notes]) => ({ day, notes })),
        5,
      ),
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
        <RailHeader label="近期发布" />
        <ol className="relative space-y-3">
          {computed.dayGroups.map((group, i) => {
            const isFirst = i === 0
            const isLast = i === computed.dayGroups.length - 1
            return (
              <li key={group.day} className="relative pl-5">
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-[5px] size-2 rounded-full ring-2 ring-bg',
                    isFirst ? 'bg-text' : 'border border-text-faint bg-bg',
                  )}
                />
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute left-[3.5px] top-3 h-full w-px bg-border-strong"
                  />
                )}
                <div className="text-xs text-text-faint">{formatGroupDay(group.day)}</div>
                <ul className="mt-1 space-y-0.5">
                  {group.notes.map((n) => (
                    <li key={n.id}>
                      <Link
                        to={`/note/${n.id}`}
                        className="block truncate text-xs text-text-muted transition hover:text-text"
                        title={n.title}
                      >
                        {n.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ol>
      </section>
    </aside>
  )
}

function formatGroupDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return day
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  return `${diffDays} 天前`
}

function capDayGroups(
  groups: { day: string; notes: Note[] }[],
  maxNotes: number,
): { day: string; notes: Note[] }[] {
  const out: { day: string; notes: Note[] }[] = []
  let used = 0
  for (const g of groups) {
    if (used >= maxNotes) break
    const take = g.notes.slice(0, maxNotes - used)
    out.push({ day: g.day, notes: take })
    used += take.length
  }
  return out
}

function RailHeader({ icon: Icon, label }: { icon?: typeof Tag; label: string }) {
  return (
    <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-faint">
      {Icon && <Icon size={12} aria-hidden />}
      {label}
    </h3>
  )
}
