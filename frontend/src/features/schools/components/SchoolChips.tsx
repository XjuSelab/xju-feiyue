import { cn } from '@/lib/cn'
import { SCHOOLS, SCHOOL_GROUPS } from '../data'
import type { GroupCode, SchoolCode } from '../types'

interface SchoolChipsProps {
  group: GroupCode
  school: SchoolCode
  schoolCounts: Record<SchoolCode, number>
  /**
   * Dynamic chip list for the "高校信息" (`all`) tab — schools actually
   * present in the current dataset, sorted descending by count. For
   * static groups (top2/华五/c9) this is ignored; the group's hardcoded
   * `schools` array wins.
   */
  dynamicAllSchools: SchoolCode[]
  onGroup: (g: GroupCode) => void
  onSchool: (s: SchoolCode) => void
}

export function SchoolChips({
  group,
  school,
  schoolCounts,
  dynamicAllSchools,
  onGroup,
  onSchool,
}: SchoolChipsProps) {
  const activeGroup = SCHOOL_GROUPS.find((g) => g.code === group) ?? SCHOOL_GROUPS[0]!
  const chipSchools: SchoolCode[] = group === 'all' ? dynamicAllSchools : activeGroup.schools

  return (
    <>
      <div className="schools-grp-tabs mb-3.5 flex border-b border-border">
        {SCHOOL_GROUPS.map((g) => {
          const schoolsForCount: SchoolCode[] = g.code === 'all' ? dynamicAllSchools : g.schools
          const n = schoolsForCount.reduce((s, k) => s + (schoolCounts[k] || 0), 0)
          const on = group === g.code
          return (
            <button
              key={g.code}
              type="button"
              onClick={() => onGroup(g.code)}
              className={cn(
                'schools-grp-tab relative cursor-pointer px-3.5 pb-3 pt-2 font-serif text-[17px] font-medium tracking-[-0.005em] transition-colors',
                on ? 'text-text' : 'text-text-muted hover:text-text',
              )}
              data-on={on || undefined}
            >
              {g.label}
              <span className="ml-1.5 align-top font-mono text-[11px] text-text-faint">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-4.5 flex flex-wrap gap-1.5" style={{ marginBottom: 18 }}>
        {chipSchools.length === 0 && group === 'all' && (
          <div className="font-sans text-[12.5px] italic text-text-faint">数据库暂无收录的学校</div>
        )}
        {chipSchools.map((sk) => {
          const s = SCHOOLS[sk]
          if (!s) return null
          const on = school === sk
          return (
            <button
              key={sk}
              type="button"
              onClick={() => onSchool(sk)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3 font-sans text-[13px] transition-colors',
                on
                  ? 'border-text bg-text text-white'
                  : 'border-border bg-bg text-text hover:bg-bg-subtle',
              )}
            >
              <span>{s.name_cn}</span>
              <span className="font-mono text-[11px] opacity-55">{schoolCounts[sk]}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
