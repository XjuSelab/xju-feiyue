/**
 * 成绩单解析器（纯函数，不依赖 pdf.js / DOM，便于单测）。
 *
 * 输入：pdf.js `getTextContent()` 各页文本项 RawTextItem[]（按页分组）。
 * 输出：所有「通识选修·X模块」记录 TranscriptRecord[]。
 *
 * 难点与对策（见 plan 与样例 PDF）：
 * - 课程名单元格会跨两行换行（如「…（通识选修·」+「D模块）」）→ 按 y 重组视觉行，
 *   再以「课程代码 [xxxxxx] 开头」为记录起点，把后续续行并入同一记录。
 * - 序号/数字与课程名可能不在同一视觉行 → 记录边界用课程代码而非序号判定。
 * - 列归属用表头各列的 x 边界（相邻列中点）分桶，数字列取首个可解析数值。
 * - 末尾「类别×学分」汇总表不含「通识选修·X模块」字样 → 天然被过滤。
 */
import type { RawTextItem, TranscriptRecord } from '../types'

/** 同一视觉行的 y 容差（pt）。同基线文本 y 几乎相等；行间距远大于此值。 */
const Y_TOL = 3

/**
 * 模块标记：通识选修·X模块。分隔符容忍 · (U+00B7) / • / ‧ / ・ / ∙，或缺失/空格。
 * 「通识选修」前可有「尔雅」「学堂云」等前缀，正则只匹配核心片段。
 */
export const MODULE_RE = /通识选修\s*[·•‧・∙]?\s*([A-Za-z])\s*模块/

/** 表头各列标签（用于定位列 x 边界）。 */
const HEADER_LABELS = [
  '序号',
  '课程/环节',
  '学分',
  '总学时',
  '类别',
  '修读性质',
  '考核方式',
  '成绩',
  '获得学分',
  '绩点',
  '学分绩点',
  '备注',
] as const

type ColLabel = (typeof HEADER_LABELS)[number]

/** 列模型：每列的标签与左右 x 边界。 */
type ColumnModel = { label: ColLabel; left: number; right: number }[]

/** 全角数字/拉丁字母 → 半角；标点（括号/冒号等）保留，避免破坏课程名显示。 */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  )
}

/** 取文本中第一个可解析数字（含小数）。 */
function firstNumber(s: string): number | null {
  const m = s.match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}

/** 把页内文本项按 y 聚类成视觉行，每行内按 x 升序。 */
export function clusterLines(items: RawTextItem[]): RawTextItem[][] {
  const sorted = items
    .filter((i) => i.str.trim() !== '')
    .map((i) => ({ ...i, str: toHalfWidth(i.str) }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: RawTextItem[][] = []
  let cur: RawTextItem[] = []
  let anchorY = Number.POSITIVE_INFINITY
  for (const it of sorted) {
    if (cur.length === 0 || Math.abs(it.y - anchorY) <= Y_TOL) {
      if (cur.length === 0) anchorY = it.y
      cur.push(it)
    } else {
      lines.push(cur.sort((a, b) => a.x - b.x))
      cur = [it]
      anchorY = it.y
    }
  }
  if (cur.length) lines.push(cur.sort((a, b) => a.x - b.x))
  return lines
}

/** 该行是否为表头（含「课程/环节」，或同时含「序号」「获得学分」）。 */
function isHeaderLine(text: string): boolean {
  return text.includes('课程/环节') || (text.includes('序号') && text.includes('获得学分'))
}

/** 课程代码：[ 后接数字。用于定位课程数据列左缘 + 识别记录起点。 */
const CODE_RE = /^\s*\[\d/

/** 课程数据列的实际左 x（取所有「[数字…」课程代码项的最小 x）。无则返回 null。 */
function courseDataLeft(pageItems: RawTextItem[]): number | null {
  const xs = pageItems.filter((i) => CODE_RE.test(i.str)).map((i) => i.x)
  return xs.length ? Math.min(...xs) : null
}

/**
 * 从表头行构建列模型（相邻列中点为边界）。找到的列不足时返回 null。
 * 课程名列左对齐而表头标签居中，故用本页课程代码的实际左缘校正「序号|课程」边界，
 * 否则短课程名（如「军训」）的中心会落到序号列、导致整行并入上一条记录。
 */
export function buildColumns(
  headerLine: RawTextItem[],
  pageItems: RawTextItem[] = [],
): ColumnModel | null {
  const found: { label: ColLabel; left: number; right: number }[] = []
  for (const label of HEADER_LABELS) {
    const it = headerLine.find((i) => i.str.replace(/\s/g, '') === label)
    if (it) found.push({ label, left: it.x, right: it.x + it.w })
  }
  // 关键列齐全才可靠分桶。
  const need: ColLabel[] = ['课程/环节', '学分', '类别', '成绩', '获得学分']
  if (!need.every((n) => found.some((f) => f.label === n))) return null

  found.sort((a, b) => a.left - b.left)
  const cols: ColumnModel = found.map((f, i) => {
    const prev = found[i - 1]
    const next = found[i + 1]
    return {
      label: f.label,
      left: prev ? (prev.right + f.left) / 2 : Number.NEGATIVE_INFINITY,
      right: next ? (f.right + next.left) / 2 : Number.POSITIVE_INFINITY,
    }
  })

  // 用课程数据实际左缘把「序号|课程」边界拉到课程代码左侧（≈88），收编短课程名。
  const courseLeft = courseDataLeft(pageItems)
  const ci = cols.findIndex((c) => c.label === '课程/环节')
  const courseCol = cols[ci]
  const idxCol = cols[ci - 1]
  if (courseLeft != null && courseCol && idxCol) {
    const boundary = courseLeft - 3
    courseCol.left = boundary
    idxCol.right = boundary
  }
  return cols
}

/** 按 x 中心把文本项归入列标签；超出所有列则归 null。 */
function columnOf(item: RawTextItem, cols: ColumnModel): ColLabel | null {
  const cx = item.x + item.w / 2
  for (const c of cols) if (cx >= c.left && cx < c.right) return c.label
  return null
}

/** 记录累加器：逐列收集文本片段（保持出现顺序），并保留全行原文兜底。 */
type RecordAcc = {
  cols: Partial<Record<ColLabel, string[]>>
  /** 全部文本项按阅读顺序拼接，用于模块标记兜底匹配（防列归属误差）。 */
  raw: string[]
}

function newAcc(): RecordAcc {
  return { cols: {}, raw: [] }
}

function appendLine(acc: RecordAcc, line: RawTextItem[], cols: ColumnModel): void {
  for (const it of line) {
    acc.raw.push(it.str)
    const label = columnOf(it, cols)
    if (!label) continue
    ;(acc.cols[label] ??= []).push(it.str)
  }
}

/** 去掉课程代码前缀 [xxxxxx] 与模块后缀 （…通识选修·X模块），得可读名。 */
export function cleanCourseName(course: string): string {
  let s = course.replace(/^\s*\[[^\]]*\]\s*/, '')
  // 去掉末尾含「通识选修·X模块」的括号片段（中英文括号皆可；右括号可能因换行丢失，故可选）。
  s = s.replace(/[（(][^（()]*通识选修[^（()]*模块[)）]?\s*$/, '')
  return s.trim()
}

/** 把累加器收尾成一条记录（未含模块标记则返回 null）。 */
function finalize(acc: RecordAcc, semester: string): TranscriptRecord | null {
  const course = (acc.cols['课程/环节'] ?? []).join('').trim()
  // 先用课程名列匹配；列归属偶有误差时退回全行原文兜底。
  const moduleLetter = (course.match(MODULE_RE) ?? acc.raw.join('').match(MODULE_RE))?.[1]
  if (!moduleLetter) return null
  const credit = firstNumber((acc.cols['学分'] ?? []).join(' ')) ?? 0
  const earned = firstNumber((acc.cols['获得学分'] ?? []).join(' ')) ?? 0
  return {
    course,
    displayName: cleanCourseName(course),
    module: moduleLetter.toUpperCase(),
    credit,
    earnedCredit: earned,
    grade: (acc.cols['成绩'] ?? []).join('').trim(),
    category: (acc.cols['类别'] ?? []).join('').trim(),
    semester,
  }
}

/** 解析整份成绩单，返回所有「通识选修·X模块」记录。 */
export function parseTranscript(pages: RawTextItem[][]): TranscriptRecord[] {
  const out: TranscriptRecord[] = []
  let columns: ColumnModel | null = null
  let semester = ''

  for (const items of pages) {
    const lines = clusterLines(items)
    let acc: RecordAcc | null = null

    const flush = () => {
      if (acc) {
        const rec = finalize(acc, semester)
        if (rec) out.push(rec)
        acc = null
      }
    }

    for (const line of lines) {
      const text = line.map((i) => i.str).join('').trim()

      // 末尾汇总表（类别×学分）→ 本页后续不再是选课明细。
      if (text.includes('修读课程环节数') || text.includes('加权平均')) {
        flush()
        break
      }
      // 表头：刷新列模型（用本页数据校正课程列左缘）。
      if (isHeaderLine(text)) {
        flush()
        columns = buildColumns(line, items) ?? columns
        continue
      }
      // 页脚「第 X 页 共 Y 页」。
      if (/第\s*\d+\s*页/.test(text)) {
        flush()
        continue
      }
      // 学年学期。
      const sm = text.match(/学年学期[:：]\s*(.+)$/)
      if (sm) {
        flush()
        semester = sm[1]?.trim() ?? semester
        continue
      }
      if (!columns) continue
      const cols = columns

      // 行内出现课程代码「[数字…」→ 新记录起点（不依赖列归属，短课程名也可靠）。
      const isStart = line.some((it) => CODE_RE.test(it.str))
      if (isStart) flush()
      if (isStart || acc) {
        acc ??= newAcc()
        appendLine(acc, line, cols)
      }
    }
    flush()
  }

  return out
}
