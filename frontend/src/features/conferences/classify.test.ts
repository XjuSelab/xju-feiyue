import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { classify, daysUntil, progressForBar } from './classify'
import { applyFilters } from './filter'
import { applySort, smartSort } from './sort'
import type { Conference } from './types'

// Pin "today" so the date-relative classification is deterministic.
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 4, 26, 9, 0, 0)) // 2026-05-26 09:00 local
})
afterAll(() => vi.useRealTimers())

const conf = (over: Partial<Conference>): Conference => ({
  id: over.id ?? 'x',
  abbr: over.abbr ?? 'X',
  name_full: over.name_full ?? 'X full',
  field: over.field ?? 'ai',
  tier: over.tier ?? 'A',
  publisher: over.publisher ?? 'ACM',
  dblp: over.dblp ?? 'https://dblp/x',
  homepage: over.homepage ?? null,
  cycle: over.cycle ?? null,
  location: over.location ?? null,
  conf_date: over.conf_date ?? null,
  deadline: over.deadline ?? null,
  note: over.note ?? null,
})

const BLANK = {
  tier: [] as never[],
  status: [] as never[],
  pub: [] as never[],
  q: '',
  aOnly: false,
  upcoming: false,
}

describe('classify', () => {
  it('null deadline → tbd', () => {
    expect(classify(conf({ deadline: null }))).toBe('tbd')
  })
  it('past deadline → closed', () => {
    expect(classify(conf({ deadline: '2025-08-08' }))).toBe('closed')
  })
  it('within 30 days → soon', () => {
    expect(classify(conf({ deadline: '2026-06-10' }))).toBe('soon')
  })
  it('further than 30 days → open', () => {
    expect(classify(conf({ deadline: '2026-09-01' }))).toBe('open')
  })
  it('daysUntil is negative for the past, positive for the future', () => {
    expect(daysUntil('2025-08-08')).toBeLessThan(0)
    expect(daysUntil('2026-09-01')).toBeGreaterThan(30)
    expect(daysUntil(null)).toBeNull()
  })
  it('progressForBar: closed=100, far-future floors at 5', () => {
    expect(progressForBar('2025-08-08')).toBe(100)
    expect(progressForBar('2027-01-01')).toBe(5)
    expect(progressForBar(null)).toBe(0)
  })
})

describe('applyFilters', () => {
  const rows: Conference[] = [
    conf({ id: 'a', abbr: 'PPoPP', tier: 'A', field: 'arch', deadline: '2025-08-08' }), // closed
    conf({ id: 'b', abbr: 'EMNLP', tier: 'B', field: 'ai', deadline: '2026-06-10' }), // soon
    conf({ id: 'c', abbr: 'PACT', tier: 'B', field: 'arch', deadline: null }), // tbd
    conf({ id: 'd', abbr: 'AAAI', tier: 'A', field: 'ai', deadline: '2026-09-01' }), // open
  ]
  it('filters by field tab', () => {
    expect(applyFilters(rows, 'arch', { ...BLANK }).map((r) => r.id)).toEqual(['a', 'c'])
  })
  it('filters by tier + status', () => {
    expect(applyFilters(rows, 'all', { ...BLANK, tier: ['A'] }).map((r) => r.id)).toEqual([
      'a',
      'd',
    ])
    expect(applyFilters(rows, 'all', { ...BLANK, status: ['soon'] }).map((r) => r.id)).toEqual([
      'b',
    ])
  })
  it('"有未来截稿" drops past + tbd', () => {
    expect(applyFilters(rows, 'all', { ...BLANK, upcoming: true }).map((r) => r.id)).toEqual([
      'b',
      'd',
    ])
  })
  it('search matches abbr case-insensitively', () => {
    expect(applyFilters(rows, 'all', { ...BLANK, q: 'aaai' }).map((r) => r.id)).toEqual(['d'])
  })
})

describe('sort', () => {
  const rows: Conference[] = [
    conf({ id: 'closed', deadline: '2025-08-08', tier: 'A', abbr: 'ZZZ' }),
    conf({ id: 'open', deadline: '2026-09-01' }),
    conf({ id: 'soon', deadline: '2026-06-10' }),
    conf({ id: 'tbd', deadline: null, tier: 'A', abbr: 'AAA' }),
  ]
  it('smartSort orders soon → open → tbd → closed', () => {
    expect(smartSort(rows).map((r) => r.id)).toEqual(['soon', 'open', 'tbd', 'closed'])
  })
  it('applySort by deadline asc sinks null to the end', () => {
    expect(applySort(rows, { key: 'deadline', dir: 'asc' }).map((r) => r.id)).toEqual([
      'closed',
      'soon',
      'open',
      'tbd',
    ])
  })
})
