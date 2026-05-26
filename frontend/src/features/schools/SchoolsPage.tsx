import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { C9_SCHOOLS, SCHOOL_GROUPS } from './data'

const C9_SET = new Set<SchoolCode>(C9_SCHOOLS)
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

const LIST_STALE_MS = 5 * 60_000

export function SchoolsPage() {
  const queryClient = useQueryClient()
  const [group, setGroup] = useState<GroupCode>('top2')
  const [school, setSchool] = useState<SchoolCode>('tsinghua')
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [filters, setFilters] = useState<FilterState>(BLANK_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)

  // Hover/focus a school chip → warm its list into the cache. Switching school
  // resets filters/sort to the blank defaults (see effect below), so the
  // prefetched key matches the query that fires on click → instant render.
  const prefetchSchool = useCallback(
    (code: SchoolCode) => {
      const params = buildListParams(code, BLANK_FILTERS, DEFAULT_SORT)
      void queryClient.prefetchQuery({
        queryKey: ['schools', 'list', params],
        queryFn: () => listAdvisors(params),
        staleTime: LIST_STALE_MS,
      })
    },
    [queryClient],
  )

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

  // 高校信息 group：从 meta 取**非 C9** 的实际收录学校，与 C9 tab 互补。
  // 不要求 code 已在前端 SCHOOLS 登记——name_cn 走 meta fallback，
  // 这样 sqlite 加新校时前端零改动。
  const dynamicAllSchools = useMemo<SchoolCode[]>(() => {
    const items = metaQuery.data?.schools ?? []
    return items
      .filter((s) => s.count > 0 && !C9_SET.has(s.code))
      .sort((a, b) => b.count - a.count)
      .map((s) => s.code)
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
    staleTime: LIST_STALE_MS,
  })

  const detailQuery = useQuery({
    queryKey: ['schools', 'detail', pickedId],
    queryFn: () => getAdvisor(pickedId as number),
    enabled: pickedId != null,
  })

  // School chip counts + canonical names from /schools/meta (both fall
  // back to empty / 0 while the meta query is loading).
  const schoolCounts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = {}
    metaQuery.data?.schools.forEach((s) => {
      c[s.code] = s.count
    })
    return c
  }, [metaQuery.data])

  const schoolNames = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    metaQuery.data?.schools.forEach((s) => {
      m[s.code] = s.name_cn
    })
    return m
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
  const schoolNum = metaQuery.data?.schools.length ?? 0
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
          {schoolNum} 校 · <strong className="font-semibold text-text">{allCount}</strong> 位导师 ·
          当前校 <strong className="font-semibold text-text">{schoolTotal}</strong> 位 · 招生{' '}
          <strong className="font-semibold text-cat-tools">{recruitingShown}</strong> · 风评负面{' '}
          <strong className="font-semibold text-cat-research">{negShown}</strong>
        </div>
      </header>

      <SchoolChips
        group={group}
        school={school}
        schoolCounts={schoolCounts}
        schoolNames={schoolNames}
        dynamicAllSchools={dynamicAllSchools}
        onGroup={setGroup}
        onSchool={setSchool}
        onPrefetch={prefetchSchool}
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
