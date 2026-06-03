import { describe, it, expect } from 'vitest'
import { buildReport, fmtCredit } from './rules'
import type { ModuleStat, TranscriptRecord } from '../types'

function r(module: string, earned: number, course: string): TranscriptRecord {
  return {
    course,
    displayName: course,
    module,
    credit: earned,
    earnedCredit: earned,
    grade: '90',
    category: '',
    semester: '',
  }
}

/** 全部达标的基准选课集（A2 / B4 / C2含四史 / D3含美育2+劳动1 / E2）。 */
function basePass(): TranscriptRecord[] {
  return [
    r('A', 2, '经典照耀青春讲堂'),
    r('B', 2, '算法与程序的奥秘'),
    r('B', 2, '动手学AI'),
    r('C', 1, '四史/改革开放史'),
    r('C', 1, '数字影视编导与制作'),
    r('D', 2, '美育/新疆民族舞蹈1'),
    r('D', 1, '劳动/大学生劳动教育'),
    r('E', 2, '数学竞赛选讲II'),
  ]
}

const mod = (modules: ModuleStat[], m: string) =>
  modules.find((x) => x.module === m)!

describe('buildReport — 全部达标', () => {
  const report = buildReport(basePass())

  it('总体通过、无未达标项', () => {
    expect(report.passed).toBe(true)
    expect(report.failedReasons).toHaveLength(0)
  })

  it('展示 A–E 五个模块且均达标', () => {
    expect(report.modules.map((m) => m.module)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(report.modules.every((m) => m.passed)).toBe(true)
  })

  it('模块学分汇总正确', () => {
    expect(mod(report.modules, 'B').earnedCredits).toBe(4)
    expect(mod(report.modules, 'D').earnedCredits).toBe(3)
  })

  it('C 含四史、D 含美育与劳动的特殊项通过', () => {
    expect(mod(report.modules, 'C').specials[0]?.passed).toBe(true)
    const d = mod(report.modules, 'D')
    expect(d.specials.find((s) => s.keyword === '美育')?.passed).toBe(true)
    expect(d.specials.find((s) => s.keyword === '劳动')?.passed).toBe(true)
  })
})

describe('buildReport — 缺失模块', () => {
  it('完全没选 E 模块 → E 不达标、总体不通过', () => {
    const recs = basePass().filter((x) => x.module !== 'E')
    const report = buildReport(recs)
    const e = mod(report.modules, 'E')
    expect(e.earnedCredits).toBe(0)
    expect(e.meetsMin).toBe(false)
    expect(e.passed).toBe(false)
    expect(report.passed).toBe(false)
    expect(report.failedReasons.some((s) => s.includes('模块E'))).toBe(true)
  })
})

describe('buildReport — 特殊要求未达标', () => {
  it('C 模块够 2 学分但缺四史 → 不通过', () => {
    const recs = [
      ...basePass().filter((x) => x.module !== 'C'),
      r('C', 1, '数字影视编导与制作'),
      r('C', 1, '名画鉴赏'),
    ]
    const report = buildReport(recs)
    const c = mod(report.modules, 'C')
    expect(c.meetsMin).toBe(true)
    expect(c.specials[0]?.passed).toBe(false)
    expect(c.passed).toBe(false)
    expect(report.failedReasons.some((s) => s.includes('四史'))).toBe(true)
  })

  it('D 模块美育仅 1 学分 → 不通过', () => {
    const recs = [
      ...basePass().filter((x) => x.module !== 'D'),
      r('D', 1, '美育/舞蹈'),
      r('D', 1, '劳动/劳动教育'),
    ]
    const report = buildReport(recs)
    expect(report.passed).toBe(false)
    expect(report.failedReasons.some((s) => s.includes('美育'))).toBe(true)
  })

  it('D 模块缺劳动 → 不通过', () => {
    const recs = [
      ...basePass().filter((x) => x.module !== 'D'),
      r('D', 2, '美育/舞蹈'),
      r('D', 1, '书法艺术'),
    ]
    const report = buildReport(recs)
    expect(report.passed).toBe(false)
    expect(report.failedReasons.some((s) => s.includes('劳动'))).toBe(true)
  })
})

describe('buildReport — 非必修模块', () => {
  it('额外模块 F 不影响总体结论，且按选修展示', () => {
    const recs = [...basePass(), r('F', 1, '某尔雅课')]
    const report = buildReport(recs)
    const f = mod(report.modules, 'F')
    expect(f.required).toBe(false)
    expect(f.minCredits).toBe(0)
    expect(f.passed).toBe(true)
    expect(report.passed).toBe(true)
  })
})

describe('fmtCredit', () => {
  it.each([
    [2, '2'],
    [0, '0'],
    [2.5, '2.5'],
    [4, '4'],
  ])('fmtCredit(%d) -> %s', (n, expected) => {
    expect(fmtCredit(n)).toBe(expected)
  })
})
