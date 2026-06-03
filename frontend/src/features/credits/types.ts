/**
 * 学分统计 —— 类型定义。
 *
 * 解析链路：pdf.js 文本项(RawTextItem) → parseTranscript → TranscriptRecord[]
 *           → buildReport → CreditReport(各模块统计 + 规则判定)。
 */

/** pdf.js `getTextContent()` 单个文本项的精简形式（x/y 取自 transform 矩阵）。 */
export type RawTextItem = {
  str: string
  /** transform[4]，左下原点、向右为正。 */
  x: number
  /** transform[5]，左下原点、向上为正。 */
  y: number
  /** 文本块宽度。 */
  w: number
  /** 文本块高度（≈ 字号）。 */
  h: number
}

/** 一条「通识选修·X模块」选课记录。 */
export type TranscriptRecord = {
  /** 完整「课程/环节」文本（含课程代码与模块标记）。 */
  course: string
  /** 去掉代码与模块后缀后的可读课程名。 */
  displayName: string
  /** 模块字母，大写（A/B/C/D/E…）。 */
  module: string
  /** 「学分」列（计划学分）。 */
  credit: number
  /** 「获得学分」列（达标判定口径）。 */
  earnedCredit: number
  /** 「成绩」列原文（数字 / 合格 / 优秀…）。 */
  grade: string
  /** 「类别」列。 */
  category: string
  /** 学年学期。 */
  semester: string
}

/** 模块内的「特殊要求」判定结果（如四史 / 美育 / 劳动）。 */
export type SpecialRuleResult = {
  key: string
  /** 展示名，如「“四史”类课程」。 */
  label: string
  module: string
  keyword: string
  minCredits: number
  matchedCredits: number
  matchedCourses: TranscriptRecord[]
  passed: boolean
}

/** 单个模块的统计与达标结果。 */
export type ModuleStat = {
  module: string
  /** 模块中文名（可为空）。 */
  name: string
  /** 是否为学校规定的必修模块（参与缺失判定）。 */
  required: boolean
  earnedCredits: number
  records: TranscriptRecord[]
  /** 该模块最低学分要求（必修模块为 MODULE_MIN_CREDITS，否则 0）。 */
  minCredits: number
  meetsMin: boolean
  specials: SpecialRuleResult[]
  /** 模块整体达标 = 满足最低学分 且 所有特殊要求达标。 */
  passed: boolean
}

/**
 * 「从教务系统自动导入」的全程状态机：
 * - idle：未在等待；进页面 / 切回标签页仍会静默探一次暂存件。
 * - waiting：点了按钮，正在主动轮询后端暂存件（转圈）。
 * - received：已取到回传 PDF，正在解析（转圈，绿色），直到解析返回才结束。
 * - error：轮询超时 / 取回的 PDF 解析失败（红色，可重试）。
 */
export type ImportPhase = 'idle' | 'waiting' | 'received' | 'error'

/** 整份成绩单的通识选修达标报告。 */
export type CreditReport = {
  records: TranscriptRecord[]
  modules: ModuleStat[]
  /** 是否完全符合学校要求。 */
  passed: boolean
  /** 未达标原因（逐条人类可读）。 */
  failedReasons: string[]
}
