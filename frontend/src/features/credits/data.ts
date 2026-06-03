/**
 * 学分统计 —— 学校通识选修要求配置（集中可调）。
 *
 * 规则来源（新疆大学通识选修）：
 * - 每个模块获得学分不少于 2 学分；
 * - 模块 C 需含「四史」类课程 ≥ 1 学分；
 * - 模块 D 需含「美育」课程 ≥ 2 学分 且 劳动理论教育课 ≥ 1 学分。
 * 判定口径：「获得学分」列。
 */

/** 每个必修模块的最低（获得）学分。 */
export const MODULE_MIN_CREDITS = 2

/** 学校规定必须修读的模块集合；缺失（0 学分）按不达标处理。 */
export const REQUIRED_MODULES = ['A', 'B', 'C', 'D', 'E'] as const

/**
 * 模块中文名（可选，仅用于展示）。学校官方名称未知时留空，UI 仅显示「模块X」。
 * 日后若拿到官方名称，填进这里即可。
 */
export const MODULE_NAMES: Record<string, string> = {
  A: '',
  B: '',
  C: '',
  D: '',
  E: '',
}

/** 模块内「特殊课程」要求。keyword 命中课程名即计入该项学分。 */
export type SpecialRuleConfig = {
  key: string
  module: string
  /** 在课程名中匹配的关键字。 */
  keyword: string
  /** 该项最低学分。 */
  minCredits: number
  /** 展示名。 */
  label: string
}

export const SPECIAL_RULES: SpecialRuleConfig[] = [
  { key: 'c-sishi', module: 'C', keyword: '四史', minCredits: 1, label: '“四史”类课程' },
  { key: 'd-meiyu', module: 'D', keyword: '美育', minCredits: 2, label: '“美育”课程' },
  { key: 'd-labor', module: 'D', keyword: '劳动', minCredits: 1, label: '劳动理论教育课' },
]

/** 无法从 PDF 核验、仅作提示的要求。 */
export const ADVISORY_NOTES: string[] = [
  '需在学校开设的通识选修课轮次中选课（本工具无法从成绩单核验）。',
]
