import type { TaskStatus } from '@/api/schemas/class'

/**
 * 班级域展示常量 —— 甘特任务状态的标签与配色。
 * 色值走既有分类色 token（tailwind.config 的 cat-*），深浅主题自适应。
 */
export const STATUS_META: Record<
  TaskStatus,
  { label: string; barClass: string; fillClass: string }
> = {
  todo: {
    label: '待办',
    barClass: 'border-border-strong bg-bg-subtle text-text',
    fillClass: 'bg-border-strong/60',
  },
  doing: {
    label: '进行中',
    barClass: 'border-cat-kaggle/50 bg-tag-kaggle text-text',
    fillClass: 'bg-cat-kaggle/45',
  },
  done: {
    label: '已完成',
    barClass: 'border-cat-tools/50 bg-tag-tools text-text-muted',
    fillClass: 'bg-cat-tools/40',
  },
}

export const STATUS_ORDER: TaskStatus[] = ['todo', 'doing', 'done']

/** 甘特列宽（px/天）—— lib/gantt 的 snapDays 与渲染共用。 */
export const GANTT_DAY_WIDTH = 32
