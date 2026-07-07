import { z } from 'zod'
import { NoteAuthorSchema } from './note'

export const ReportReasonSchema = z.enum([
  'spam',
  'harassment',
  'sexual',
  'illegal',
  'misinfo',
  'infringement',
  'other',
])
export type ReportReason = z.infer<typeof ReportReasonSchema>

/** Reason options with Chinese labels, in display order. */
export const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: '垃圾广告' },
  { value: 'harassment', label: '辱骂骚扰' },
  { value: 'sexual', label: '色情低俗' },
  { value: 'illegal', label: '违法有害' },
  { value: 'misinfo', label: '不实信息' },
  { value: 'infringement', label: '侵权' },
  { value: 'other', label: '其他' },
]

export const reasonLabel = (v: string): string =>
  REPORT_REASONS.find((r) => r.value === v)?.label ?? v

/** Mirror of backend ReportOut. */
export const ReportSchema = z.object({
  id: z.string(),
  targetType: z.string(),
  targetNoteId: z.string().nullish(),
  targetCommentId: z.string().nullish(),
  targetSnapshot: z.string().default(''),
  reason: z.string(),
  description: z.string().nullish(),
  status: z.string(),
  aiLabel: z.string().nullish(),
  aiConfidence: z.number().nullish(),
  aiReason: z.string().nullish(),
  resolutionAction: z.string().nullish(),
  resolutionComment: z.string().nullish(),
  resolvedBySid: z.string().nullish(),
  resolvedAt: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reporter: NoteAuthorSchema.nullish(),
})
export type Report = z.infer<typeof ReportSchema>
export const ReportListSchema = z.array(ReportSchema)

/** Mirror of backend BlockOut. */
export const BlockSchema = z.object({
  user: NoteAuthorSchema,
  createdAt: z.string(),
})
export type Block = z.infer<typeof BlockSchema>
export const BlockListSchema = z.array(BlockSchema)

export type ReportCreateIn = {
  targetType: 'note' | 'comment'
  targetId: string
  reason: ReportReason
  description?: string
}
export type ReportResolveIn = { action: 'hide' | 'delete' | 'dismiss'; comment?: string }
