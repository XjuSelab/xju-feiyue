import { describe, it, expect } from 'vitest'
import { cleanCourseName, MODULE_RE, parseTranscript } from './parseTranscript'
import type { RawTextItem } from '../types'

/** 构造一个文本项；w 默认 10。 */
const t = (str: string, x: number, y: number, w = 10): RawTextItem => ({
  str,
  x,
  y,
  w,
  h: 9,
})

/** 各列 x（与 buildColumns 的边界推导对应）。 */
const X = {
  idx: 42,
  course: 80,
  credit: 300,
  hours: 345,
  cat: 390,
  nature: 462,
  exam: 512,
  grade: 582,
  earned: 622,
  gp: 682,
  cgp: 722,
}

function header(y: number): RawTextItem[] {
  return [
    t('序号', 40, y, 16),
    // 表头标签「居中」，左缘(140)远离左对齐的课程数据(x=80)——复现真实成绩单，
    // 用于验证 buildColumns 以课程数据实际左缘校正「序号|课程」边界。
    t('课程/环节', 140, y, 40),
    t('学分', 300, y, 16),
    t('总学时', 340, y, 24),
    t('类别', 390, y, 16),
    t('修读性质', 460, y, 32),
    t('考核方式', 510, y, 32),
    t('成绩', 580, y, 16),
    t('获得学分', 620, y, 32),
    t('绩点', 680, y, 16),
    t('学分绩点', 720, y, 32),
    t('备注', 790, y, 16),
  ]
}

/** 单行记录。 */
function row(
  y: number,
  r: {
    idx?: string
    course?: string
    credit?: string
    cat?: string
    grade?: string
    earned?: string
  },
): RawTextItem[] {
  const out: RawTextItem[] = []
  if (r.idx) out.push(t(r.idx, X.idx, y, 8))
  if (r.course) out.push(t(r.course, X.course, y, 8))
  if (r.credit) out.push(t(r.credit, X.credit, y, 12))
  out.push(t('32', X.hours, y, 12))
  if (r.cat) out.push(t(r.cat, X.cat, y, 12))
  out.push(t('初修', X.nature, y, 12))
  out.push(t('考查', X.exam, y, 12))
  if (r.grade) out.push(t(r.grade, X.grade, y, 12))
  if (r.earned) out.push(t(r.earned, X.earned, y, 12))
  return out
}

/**
 * 合成成绩单（匿名），复现样例 PDF 的关键结构：
 * - A–E 各模块、尔雅/学堂云前缀、U+00B7 分隔符；
 * - D 模块「美育」一行跨三段视觉行（名首段 / 数字+序号段 / 名尾段）。
 */
function fixturePage(): RawTextItem[] {
  const items: RawTextItem[] = [
    t('学年学期：2024-2025学年第二学期', 50, 730),
    ...header(715),
    ...row(700, {
      idx: '11',
      course: '[350008]经典照耀青春讲堂（通识选修·A模块）',
      credit: '2.0',
      cat: '公共课/任选课',
      grade: '95.1',
      earned: '2.0',
    }),
    ...row(685, {
      idx: '4',
      course: '[108000047]四史/改革开放史（通识选修·C模块）',
      credit: '1.0',
      cat: '通识教育/限选课',
      grade: '96.4',
      earned: '1.0',
    }),
    ...row(670, {
      idx: '3',
      course: '[503000600]数字影视编导与制作（尔雅通识选修·C模块）',
      credit: '1.0',
      cat: '通识教育/任选课',
      grade: '100.0',
      earned: '1.0',
    }),
    // —— D 模块「美育」：跨三段视觉行 ——
    t('[127000010]美育/新疆民族舞蹈1（男班）（通识选修·', X.course, 655, 8),
    ...row(647, {
      idx: '13',
      credit: '2.0',
      cat: '通识教育/限选课',
      grade: '85.0',
      earned: '2.0',
    }),
    t('D模块）', X.course, 639, 8),
    // —— D 模块「劳动」（学堂云前缀，单行） ——
    ...row(624, {
      idx: '16',
      course: '[503001254]劳动/大学生劳动教育（学堂云通识选修·D模块）',
      credit: '2.0',
      cat: '通识教育/限选课',
      grade: '96.0',
      earned: '2.0',
    }),
    ...row(609, {
      idx: '4',
      course: '[503000787]算法与程序的奥秘（尔雅通识选修·B模块）',
      credit: '1.0',
      cat: '通识教育/任选课',
      grade: '97.5',
      earned: '1.0',
    }),
    ...row(594, {
      idx: '5',
      course: '[503000790]名侦探柯南与化学探秘（尔雅通识选修·B模块）',
      credit: '1.0',
      cat: '通识教育/任选课',
      grade: '100.0',
      earned: '1.0',
    }),
    ...row(579, {
      idx: '14',
      course:
        '[503001373]动手学 AI：人工智能通识与实践——理工版（尔雅通识选修·B模块）',
      credit: '2.0',
      cat: '通识教育/任选课',
      grade: '99.71',
      earned: '2.0',
    }),
    ...row(564, {
      idx: '7',
      course: '[117000073]数学竞赛选讲II（通识选修·E模块）',
      credit: '2.0',
      cat: '公共课/任选课',
      grade: '92.5',
      earned: '2.0',
    }),
    // 短名非模块行（如「军训」）—— 易被并入上一条记录的回归守卫；应独立成行并被过滤。
    ...row(556, {
      idx: '12',
      course: '[410000003]军训',
      credit: '1.0',
      cat: '军训',
      grade: '优秀',
      earned: '1.0',
    }),
    // 非模块行 —— 应被过滤。
    ...row(549, {
      idx: '1',
      course: '[100580]程序设计基础',
      credit: '3.0',
      cat: '专业-24/学科基础课-必修24',
      grade: '87.0',
      earned: '3.0',
    }),
    // 末尾汇总表 —— 解析应在此停止。
    t('修读课程环节数', 80, 534),
    t('通识教育选修课', 80, 519),
  ]
  return items
}

describe('MODULE_RE', () => {
  it.each([
    ['（通识选修·E模块）', 'E'],
    ['（尔雅通识选修·B模块）', 'B'],
    ['（学堂云通识选修·D模块）', 'D'],
  ])('%s -> 模块 %s', (input, mod) => {
    expect(input.match(MODULE_RE)?.[1]).toBe(mod)
  })

  it('非通识选修课程不匹配', () => {
    expect('人工智能通识与实践'.match(MODULE_RE)).toBeNull()
    expect('通识教育/必修课'.match(MODULE_RE)).toBeNull()
  })
})

describe('cleanCourseName', () => {
  it('去掉课程代码与模块后缀', () => {
    expect(
      cleanCourseName('[350008]经典照耀青春讲堂（通识选修·A模块）'),
    ).toBe('经典照耀青春讲堂')
    expect(
      cleanCourseName('[503000787]算法与程序的奥秘（尔雅通识选修·B模块）'),
    ).toBe('算法与程序的奥秘')
  })

  it('保留课程名内部的全角括号', () => {
    expect(
      cleanCourseName('[127000010]美育/新疆民族舞蹈1（男班）（通识选修·D模块）'),
    ).toBe('美育/新疆民族舞蹈1（男班）')
  })
})

describe('parseTranscript', () => {
  const records = parseTranscript([fixturePage()])

  it('提取全部 9 条通识选修记录，过滤非模块行与汇总表', () => {
    expect(records).toHaveLength(9)
    expect(records.some((r) => r.course.includes('程序设计基础'))).toBe(false)
    expect(records.some((r) => r.course.includes('修读课程环节数'))).toBe(false)
  })

  it('各模块获得学分统计正确', () => {
    const byMod = (m: string) =>
      records
        .filter((r) => r.module === m)
        .reduce((s, r) => s + r.earnedCredit, 0)
    expect(byMod('A')).toBe(2)
    expect(byMod('B')).toBe(4)
    expect(byMod('C')).toBe(2)
    expect(byMod('D')).toBe(4)
    expect(byMod('E')).toBe(2)
  })

  it('正确重组跨行的「美育」记录', () => {
    const meiyu = records.find((r) => r.course.includes('美育'))
    expect(meiyu).toBeDefined()
    expect(meiyu?.module).toBe('D')
    expect(meiyu?.earnedCredit).toBe(2)
    expect(meiyu?.displayName).toBe('美育/新疆民族舞蹈1（男班）')
    expect(meiyu?.course).toContain('（通识选修·D模块）')
  })

  it('保留学年学期与成绩', () => {
    const a = records.find((r) => r.module === 'A')
    expect(a?.semester).toBe('2024-2025学年第二学期')
    expect(a?.grade).toBe('95.1')
  })

  it('短名非模块行不被并入上一条记录（成绩列不串行）', () => {
    // E 行后紧跟短名「军训」；若记录边界失效，E 的成绩会变成「92.5优秀」。
    const e = records.find((r) => r.module === 'E')
    expect(e?.grade).toBe('92.5')
    // 任何记录的成绩都应是单个干净值（无多行串接）。
    for (const r of records) expect(r.grade).toMatch(/^\d+(\.\d+)?$/)
  })
})
