import { describe, expect, it } from 'vitest'

import {
  addDays,
  barGeometry,
  computeWindow,
  dayCells,
  diffDays,
  formatDayNum,
  MIN_WINDOW_DAYS,
  monthSpans,
  parseDayNum,
  snapDays,
} from './gantt'

describe('parse/format/add/diff', () => {
  it('round-trips dates', () => {
    for (const s of ['2026-01-01', '2026-07-04', '2024-02-29', '1999-12-31']) {
      expect(formatDayNum(parseDayNum(s))).toBe(s)
    }
  })

  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('addDays crosses year boundaries', () => {
    expect(addDays('2025-12-30', 3)).toBe('2026-01-02')
    expect(addDays('2026-01-02', -3)).toBe('2025-12-30')
  })

  it('handles Feb-29 leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01') // 平年
  })

  it('diffDays is signed (b - a)', () => {
    expect(diffDays('2026-07-01', '2026-07-04')).toBe(3)
    expect(diffDays('2026-07-04', '2026-07-01')).toBe(-3)
    expect(diffDays('2026-07-04', '2026-07-04')).toBe(0)
  })
})

describe('computeWindow', () => {
  it('pads 3 days each side and enforces the 28-day minimum', () => {
    const w = computeWindow(
      [{ startDate: '2026-07-06', endDate: '2026-07-10' }],
      '2026-07-08',
    )
    expect(w.start).toBe('2026-07-03') // min - 3
    expect(w.days).toBe(MIN_WINDOW_DAYS) // 11 天实际范围 → 补到 28
  })

  it('expands past the minimum for long ranges', () => {
    const w = computeWindow(
      [{ startDate: '2026-07-01', endDate: '2026-08-20' }],
      '2026-07-10',
    )
    expect(w.start).toBe('2026-06-28')
    expect(w.days).toBe(diffDays('2026-06-28', '2026-08-23') + 1)
  })

  it('anchors on today when tasks are empty or all in the past', () => {
    const empty = computeWindow([], '2026-07-04')
    expect(empty.start).toBe('2026-07-01')
    expect(empty.days).toBe(MIN_WINDOW_DAYS)

    const past = computeWindow(
      [{ startDate: '2026-06-01', endDate: '2026-06-05' }],
      '2026-07-04',
    )
    // 窗口必须同时罩住任务与今天。
    expect(past.start).toBe('2026-05-29')
    expect(diffDays(past.start, '2026-07-04')).toBeLessThan(past.days)
  })
})

describe('dayCells / monthSpans', () => {
  it('flags weekends and today', () => {
    const cells = dayCells({ start: '2026-07-03', days: 5 }, '2026-07-04')
    // 2026-07-04 是周六，07-05 是周日。
    expect(cells.map((c) => c.isWeekend)).toEqual([false, true, true, false, false])
    expect(cells[1]!.isToday).toBe(true)
    expect(cells[0]!.dayOfMonth).toBe(3)
  })

  it('splits month header spans across a year boundary', () => {
    const spans = monthSpans({ start: '2025-12-30', days: 5 })
    expect(spans).toEqual([
      { label: '2025年12月', startIndex: 0, span: 2 },
      { label: '2026年1月', startIndex: 2, span: 3 },
    ])
  })
})

describe('barGeometry', () => {
  const w = { start: '2026-07-01', days: 10 } // 07-01 .. 07-10

  it('inclusive end: one-day task spans 1', () => {
    expect(barGeometry({ startDate: '2026-07-03', endDate: '2026-07-03' }, w)).toEqual({
      offset: 2,
      span: 1,
      clippedStart: false,
      clippedEnd: false,
    })
  })

  it('clips at both window edges', () => {
    expect(barGeometry({ startDate: '2026-06-28', endDate: '2026-07-02' }, w)).toEqual({
      offset: 0,
      span: 2,
      clippedStart: true,
      clippedEnd: false,
    })
    expect(barGeometry({ startDate: '2026-07-09', endDate: '2026-07-15' }, w)).toEqual({
      offset: 8,
      span: 2,
      clippedStart: false,
      clippedEnd: true,
    })
  })

  it('returns null when fully outside', () => {
    expect(barGeometry({ startDate: '2026-06-01', endDate: '2026-06-05' }, w)).toBeNull()
    expect(barGeometry({ startDate: '2026-08-01', endDate: '2026-08-05' }, w)).toBeNull()
  })
})

describe('snapDays', () => {
  it('rounds in both directions', () => {
    expect(snapDays(47, 32)).toBe(1)
    expect(snapDays(49, 32)).toBe(2)
    expect(snapDays(-47, 32)).toBe(-1)
    expect(snapDays(-49, 32)).toBe(-2)
    expect(snapDays(10, 32)).toBe(0)
  })
})
