/**
 * 通识选修达标规则引擎（纯函数）。
 * records → 各模块统计 + 特殊要求判定 + 总体结论。
 */
import {
  MODULE_MIN_CREDITS,
  MODULE_NAMES,
  REQUIRED_MODULES,
  SPECIAL_RULES,
} from '../data'
import type {
  CreditReport,
  ModuleStat,
  SpecialRuleResult,
  TranscriptRecord,
} from '../types'

/** 浮点求和后四舍五入到 2 位，消除 0.1+0.2 类误差。 */
function sumCredits(records: TranscriptRecord[]): number {
  const s = records.reduce((acc, r) => acc + r.earnedCredit, 0)
  return Math.round(s * 100) / 100
}

/** 学分格式化：整数去小数，非整数保留 1 位。 */
export function fmtCredit(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function buildReport(records: TranscriptRecord[]): CreditReport {
  const byModule = new Map<string, TranscriptRecord[]>()
  for (const r of records) {
    const arr = byModule.get(r.module) ?? []
    arr.push(r)
    byModule.set(r.module, arr)
  }

  // 展示模块 = 必修模块 ∪ 成绩单中实际出现的模块。
  const required = REQUIRED_MODULES as readonly string[]
  const moduleSet = Array.from(new Set([...required, ...byModule.keys()])).sort()

  const modules: ModuleStat[] = moduleSet.map((m) => {
    const recs = byModule.get(m) ?? []
    const earnedCredits = sumCredits(recs)
    const isRequired = required.includes(m)
    const minCredits = isRequired ? MODULE_MIN_CREDITS : 0
    const meetsMin = earnedCredits >= minCredits

    const specials: SpecialRuleResult[] = SPECIAL_RULES.filter(
      (s) => s.module === m,
    ).map((s) => {
      const matchedCourses = recs.filter((r) => r.course.includes(s.keyword))
      const matchedCredits = sumCredits(matchedCourses)
      return {
        key: s.key,
        label: s.label,
        module: m,
        keyword: s.keyword,
        minCredits: s.minCredits,
        matchedCredits,
        matchedCourses,
        passed: matchedCredits >= s.minCredits,
      }
    })

    const passed = meetsMin && specials.every((s) => s.passed)
    return {
      module: m,
      name: MODULE_NAMES[m] ?? '',
      required: isRequired,
      earnedCredits,
      records: recs,
      minCredits,
      meetsMin,
      specials,
      passed,
    }
  })

  const failedReasons: string[] = []
  for (const ms of modules) {
    if (ms.required && !ms.meetsMin) {
      failedReasons.push(
        `模块${ms.module} 获得学分 ${fmtCredit(ms.earnedCredits)}，不足 ${ms.minCredits} 学分`,
      )
    }
    for (const s of ms.specials) {
      if (!s.passed) {
        failedReasons.push(
          `模块${ms.module} 缺少${s.label} ${s.minCredits} 学分（当前 ${fmtCredit(s.matchedCredits)} 学分）`,
        )
      }
    }
  }

  return { records, modules, passed: failedReasons.length === 0, failedReasons }
}
