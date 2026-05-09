import {
  BarChart3,
  BookOpen,
  Coffee,
  GraduationCap,
  Microscope,
  Trophy,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * 七类业务分类的单一数据源。
 * - id 使用复数 `tools`（与 spec 一致）；megamenu 等若强依赖单数 `tool`，
 *   通过 `[data-cat="tool"], [data-cat="tools"]` 双 selector 过渡。
 * - colorVar 仅记录变量名，运行时由组件以 `var(${colorVar})` 解析颜色，
 *   保证唯一色源在 tokens.css。
 */
export type CategoryId =
  | 'research'
  | 'course'
  | 'recommend'
  | 'competition'
  | 'kaggle'
  | 'tools'
  | 'life'

export type Category = {
  id: CategoryId
  label: string
  icon: LucideIcon
  /** CSS variable name, e.g. '--cat-research' */
  colorVar: `--cat-${CategoryId}`
  /** CSS variable for 12% alpha tint, e.g. '--tag-research-bg' */
  tagBgVar: `--tag-${CategoryId}-bg`
  desc: string
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'research',
    label: '科研',
    icon: Microscope,
    colorVar: '--cat-research',
    tagBgVar: '--tag-research-bg',
    desc: '论文阅读 · 实验设计 · 组会汇报',
  },
  {
    id: 'course',
    label: '课程',
    icon: BookOpen,
    colorVar: '--cat-course',
    tagBgVar: '--tag-course-bg',
    desc: '课堂笔记 · 作业整理 · 考试复习',
  },
  {
    id: 'recommend',
    label: '推免',
    icon: GraduationCap,
    colorVar: '--cat-recommend',
    tagBgVar: '--tag-recommend-bg',
    desc: '夏令营 · 预推免 · 套磁经验',
  },
  {
    id: 'competition',
    label: '竞赛',
    icon: Trophy,
    colorVar: '--cat-competition',
    tagBgVar: '--tag-competition-bg',
    desc: '数模 · ACM · 创新创业赛',
  },
  {
    id: 'kaggle',
    label: 'Kaggle',
    icon: BarChart3,
    colorVar: '--cat-kaggle',
    tagBgVar: '--tag-kaggle-bg',
    desc: '比赛复盘 · 特征工程 · 模型 trick',
  },
  {
    id: 'tools',
    label: '工具',
    icon: Wrench,
    colorVar: '--cat-tools',
    tagBgVar: '--tag-tools-bg',
    desc: 'Linux · Git · LaTeX · 服务器',
  },
  {
    id: 'life',
    label: '生活',
    icon: Coffee,
    colorVar: '--cat-life',
    tagBgVar: '--tag-life-bg',
    desc: '实验室日常 · 心情碎片 · 城市记录',
  },
] as const

const CATEGORY_BY_ID: Readonly<Record<CategoryId, Category>> = Object.freeze(
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
    CategoryId,
    Category
  >,
)

export const getCategory = (id: CategoryId): Category => {
  const found = CATEGORY_BY_ID[id]
  if (!found) {
    throw new Error(`Unknown category id: ${id satisfies string}`)
  }
  return found
}
