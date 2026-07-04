import { describe, expect, it } from 'vitest'

import type { RollcallRecord } from '@/api/schemas/class'
import { absentSummary, countPresent, sortAbsentFirst } from './rollcall'

const rec = (sid: string, nickname: string, present: boolean): RollcallRecord => ({
  sid,
  nickname,
  avatarThumb: null,
  present,
  checkedAt: null,
})

const RECORDS = [
  rec('20240001003', '丙', true),
  rec('20240001001', '甲', false),
  rec('20240001004', '丁', false),
  rec('20240001002', '乙', true),
]

describe('sortAbsentFirst', () => {
  it('puts absentees first, then sorts by sid within each bucket', () => {
    expect(sortAbsentFirst(RECORDS).map((r) => r.nickname)).toEqual(['甲', '丁', '乙', '丙'])
  })

  it('does not mutate the input', () => {
    const input = [...RECORDS]
    sortAbsentFirst(input)
    expect(input).toEqual(RECORDS)
  })
})

describe('countPresent / absentSummary', () => {
  it('counts present records', () => {
    expect(countPresent(RECORDS)).toBe(2)
    expect(countPresent([])).toBe(0)
  })

  it('summarizes absentees in sid-stable order', () => {
    expect(absentSummary(sortAbsentFirst(RECORDS))).toBe('缺勤：甲、丁')
  })

  it('returns null when everyone is present', () => {
    expect(absentSummary([rec('1', 'a', true)])).toBeNull()
  })
})
