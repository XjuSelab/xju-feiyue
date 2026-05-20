export type SchoolCode = 'tsinghua' | 'pku' | 'fudan' | 'sjtu' | 'nju' | 'zju' | 'ustc'
export type GroupCode = 'top2' | 'hwu'
export type Reputation = 'positive' | 'neutral' | 'negative' | 'unknown'
export type Degree = 'PhD' | 'MS' | 'Postdoc'

export interface School {
  code: SchoolCode
  name_cn: string
  short: string
  city: string
}

export interface SchoolGroup {
  code: GroupCode
  label: string
  schools: SchoolCode[]
}

export interface Department {
  code: string
  name_cn: string
}

export interface Quota {
  year: number | null
  degree: Degree | null
  count: number | null
  confidence: number | null
  raw_text: string
  source_url: string
}

export interface Evaluation {
  source: string
  source_url: string
  content: string
  rating?: number | null
  posted_at?: string | null
}

export interface TraceItem {
  kind: 'search' | 'read' | 'final' | string
  label: string
  detail: string
}

export interface Advisor {
  id: number
  school: { code: SchoolCode; name_cn: string }
  departments: Department[]
  name_cn: string
  name_en?: string | null
  title?: string | null
  homepage: string
  source_url: string
  email?: string | null
  email_obfuscated: boolean
  phone?: string | null
  photo_url?: string | null
  bio_text?: string | null
  research_interests: string[]
  is_recruiting: boolean | null
  recruiting_confidence: number | null
  reputation_tag: Reputation | null
  enriched_summary?: string | null
  last_enriched_at?: string | null
  quotas: Quota[]
  evaluations: Evaluation[]
  trace?: TraceItem[]
}

export type RecruitFilterValue = 'yes' | 'no' | 'unk'

export interface FilterState {
  dept: string[]
  title: string[]
  recruit: RecruitFilterValue[]
  rep: Reputation[]
  q: string
  hasEmail: boolean
  hasSummary: boolean
}

export type SortKey = 'default' | 'name' | 'recruit' | 'rep' | 'updated'

export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export const BLANK_FILTERS: FilterState = {
  dept: [],
  title: [],
  recruit: [],
  rep: [],
  q: '',
  hasEmail: true,
  hasSummary: false,
}

export const DEFAULT_SORT: SortState = { key: 'default', dir: 'desc' }
