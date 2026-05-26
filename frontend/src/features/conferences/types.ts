/**
 * CCF 会议页类型定义。镜像 features/schools/types.ts 的写法：
 * 已知领域 id 给字面量联合（保留补全），同时用 `(string & {})` 兜底，
 * 这样 sqlite 加新领域时前端无需先登记也能渲染。
 */
export type FieldId =
  | 'arch'
  | 'network'
  | 'security'
  | 'se'
  | 'db'
  | 'theory'
  | 'graphics'
  | 'ai'
  | 'hci'
  | 'misc'
  | (string & {})

export type Tier = 'A' | 'B' | 'C'

/** 截稿状态：纯前端按 deadline 对比今天推导（见 classify.ts）。 */
export type ConfStatus = 'tbd' | 'closed' | 'soon' | 'open'

export interface CcfField {
  id: FieldId
  name_cn: string
  short: string
  color: string
}

export interface Conference {
  id: string
  abbr: string
  name_full: string
  field: FieldId
  tier: Tier
  publisher: string
  dblp: string
  /** 动态字段（按当年周期，由 R3 爬虫维护）；未公布时为 null。 */
  homepage: string | null
  cycle: string | null
  location: string | null
  conf_date: string | null
  /** ISO yyyy-mm-dd，或 null（未公布）。 */
  deadline: string | null
  note: string | null
}

export type ConfView = 'table' | 'timeline'
export type SortKey = 'smart' | 'abbr' | 'tier' | 'deadline'

export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export interface FilterState {
  tier: Tier[]
  status: ConfStatus[]
  pub: string[]
  q: string
  aOnly: boolean
  upcoming: boolean
}

export const BLANK_FILTERS: FilterState = {
  tier: [],
  status: [],
  pub: [],
  q: '',
  aOnly: false,
  upcoming: false,
}

export const DEFAULT_SORT: SortState = { key: 'smart', dir: 'asc' }

export const TIERS: Tier[] = ['A', 'B', 'C']

export interface StatusMeta {
  v: ConfStatus
  label: string
  sub: string
}

/** 过滤栏「截稿状态」chip 的展示元数据（顺序即展示顺序）。 */
export const STATUSES: StatusMeta[] = [
  { v: 'soon', label: '即将截稿', sub: '≤ 30 天' },
  { v: 'open', label: '征稿中', sub: '> 30 天' },
  { v: 'closed', label: '已截止', sub: '过去周期' },
  { v: 'tbd', label: '未公布', sub: '等待官宣' },
]

/** 过滤栏「出版方」快捷 chip。 */
export const PUBLISHERS_TOP = ['ACM', 'IEEE', 'IEEE/ACM', 'USENIX', 'Springer', 'AAAI']
