import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SCHOOLS, SCHOOL_GROUPS } from './data'
import {
  BLANK_FILTERS,
  DEFAULT_SORT,
  type Advisor,
  type FilterState,
  type GroupCode,
  type SchoolCode,
  type SortState,
} from './types'
import { getAdvisor, getSchoolsMeta, listAdvisors } from '@/api/endpoints/schools'
import type { ListAdvisorsParams } from '@/api/schemas/school'
import { SchoolChips } from './components/SchoolChips'
import { FilterBar } from './components/FilterBar'
import { AdvisorTable } from './components/AdvisorTable'
import { AdvisorDrawer } from './components/drawer/AdvisorDrawer'

function buildListParams(
  school: SchoolCode,
  filters: FilterState,
  sort: SortState,
): ListAdvisorsParams {
  const p: ListAdvisorsParams = {
    school: [school],
    has_email: filters.hasEmail,
    has_summary: filters.hasSummary,
    sort_key: sort.key,
    sort_dir: sort.dir,
    page: 1,
    page_size: 200,
  }
  if (filters.dept.length > 0) p.dept = filters.dept
  if (filters.title.length > 0) p.title = filters.title
  if (filters.recruit.length > 0) p.recruit = filters.recruit
  if (filters.rep.length > 0) p.rep = filters.rep
  if (filters.q.trim()) p.q = filters.q.trim()
  return p
}

export function SchoolsPage() {
  const [group, setGroup] = useState<GroupCode>('top2')
  const [school, setSchool] = useState<SchoolCode>('tsinghua')
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [filters, setFilters] = useState<FilterState>(BLANK_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)

  // reset filters/sort when school changes
  useEffect(() => {
    setFilters(BLANK_FILTERS)
    setSort(DEFAULT_SORT)
  }, [school])

  const metaQuery = useQuery({
    queryKey: ['schools', 'meta'],
    queryFn: getSchoolsMeta,
    staleTime: 5 * 60_000,
  })

  // 高校信息 group：从 meta 取实际收录的学校，count desc 排序。
  const dynamicAllSchools = useMemo<SchoolCode[]>(() => {
    const items = metaQuery.data?.schools ?? []
    return items
      .filter((s) => s.code in SCHOOLS && s.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((s) => s.code as SchoolCode)
  }, [metaQuery.data])

  // Group 切换时把 school 拉到组内第一个 chip。
  useEffect(() => {
    const sg = SCHOOL_GROUPS.find((g) => g.code === group)
    if (!sg) return
    const schools = group === 'all' ? dynamicAllSchools : sg.schools
    if (schools.length === 0) return
    if (!schools.includes(school)) {
      const first = schools[0]
      if (first) setSchool(first)
    }
  }, [group, school, dynamicAllSchools])

  const listParams = buildListParams(school, filters, sort)
  const listQuery = useQuery({
    queryKey: ['schools', 'list', listParams],
    queryFn: () => listAdvisors(listParams),
    placeholderData: (prev) => prev,
  })

  const detailQuery = useQuery({
    queryKey: ['schools', 'detail', pickedId],
    queryFn: () => getAdvisor(pickedId as number),
    enabled: pickedId != null,
  })

  // School chip counts from /schools/meta (falls back to 0 while loading).
  const schoolCounts = useMemo(() => {
    const c: Record<SchoolCode, number> = {
      tsinghua: 0,
      pku: 0,
      fudan: 0,
      sjtu: 0,
      nju: 0,
      zju: 0,
      ustc: 0,
      hit: 0,
      xjtu: 0,
    }
    metaQuery.data?.schools.forEach((s) => {
      if (s.code in c) c[s.code as SchoolCode] = s.count
    })
    return c
  }, [metaQuery.data])

  // Departments for the current school come from /schools/meta.
  const depts = useMemo(() => {
    const entry = metaQuery.data?.schools.find((s) => s.code === school)
    return entry?.departments ?? []
  }, [metaQuery.data, school])

  const rows = (listQuery.data?.items ?? []) as unknown as Advisor[]
  const total = listQuery.data?.total ?? rows.length

  const allCount = useMemo(
    () => metaQuery.data?.schools.reduce((sum, s) => sum + s.count, 0) ?? 0,
    [metaQuery.data],
  )
  const schoolTotal = schoolCounts[school] ?? 0
  const recruitingShown = rows.filter((a) => a.is_recruiting === true).length
  const negShown = rows.filter((a) => a.reputation_tag === 'negative').length

  return (
    <main className="w-full px-7 pb-16 pt-7 xl:px-10">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.01em] text-text">
          导师投递参考 · 中国顶尖 CS/AI 高校
        </h1>
        <div className="font-sans text-[13px] text-text-muted">
          7 校 · <strong className="font-semibold text-text">{allCount}</strong> 位导师 · 当前校{' '}
          <strong className="font-semibold text-text">{schoolTotal}</strong> 位 · 招生{' '}
          <strong className="font-semibold text-cat-tools">{recruitingShown}</strong> · 风评负面{' '}
          <strong className="font-semibold text-cat-research">{negShown}</strong>
        </div>
      </header>

      <SchoolChips
        group={group}
        school={school}
        schoolCounts={schoolCounts}
        dynamicAllSchools={dynamicAllSchools}
        onGroup={setGroup}
        onSchool={setSchool}
      />

      <FilterBar
        depts={depts}
        filters={filters}
        setFilters={setFilters}
        total={schoolTotal}
        shown={total}
      />

      <AdvisorTable rows={rows} onPick={(a) => setPickedId(a.id)} sort={sort} setSort={setSort} />

      <AdvisorDrawer
        advisor={(detailQuery.data as unknown as Advisor) ?? null}
        onClose={() => setPickedId(null)}
      />
    </main>
  )
}

export default SchoolsPage
