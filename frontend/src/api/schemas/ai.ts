import { z } from 'zod'

/**
 * R4 editor-agent 共享的 AI compose 契约。
 * 6 个 mode 与 design 稿 ai-drawer.jsx 操作区一致。
 */

export const AIComposeModeSchema = z.enum([
  'polish',
  'shorten',
  'expand',
  'tone',
  'translate',
  'custom',
  'summarize',
])
export type AIComposeMode = z.infer<typeof AIComposeModeSchema>

export const AIComposeRequestSchema = z.object({
  mode: AIComposeModeSchema,
  /** 用户当前选区内容；custom 模式下为 prompt 而不是被改写文本 */
  text: z.string().min(1),
  /** mode-specific 参数：tone='formal'|'casual', translate='en'|'zh', custom prompt 等 */
  options: z.record(z.unknown()).optional(),
})
export type AIComposeRequest = z.infer<typeof AIComposeRequestSchema>

/**
 * Diff segment：DiffView 渲染单元。
 * - equal: 两边相同的文字
 * - add:   新增（绿色 underline）
 * - del:   删除（红色 line-through）
 */
export const DiffSegmentSchema = z.object({
  type: z.enum(['equal', 'add', 'del']),
  text: z.string(),
})
export type DiffSegment = z.infer<typeof DiffSegmentSchema>

export const AIComposeResponseSchema = z.object({
  /** 一组 diff segments，按文档顺序 */
  segments: z.array(DiffSegmentSchema),
  /** 原始 before / after 字符串，方便撤销/历史 */
  before: z.string(),
  after: z.string(),
  /** 服务端耗时（ms），mock 600-1200 */
  elapsedMs: z.number().int().nonnegative(),
})
export type AIComposeResponse = z.infer<typeof AIComposeResponseSchema>
