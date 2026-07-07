import { z } from 'zod'
import { NoteAuthorSchema } from './note'

/**
 * Mirror of backend `CommentOut` (see backend/app/schemas/interaction.py).
 * Anchor fields are optional — when present, the comment quotes a span of
 * the note's rendered body and the UI renders an inline blockquote.
 */
export const CommentSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  author: NoteAuthorSchema,
  content: z.string(),
  createdAt: z.string(),
  /** 两层楼中楼：顶层评论 parentId=null；楼内回复 parentId=顶层评论 id。 */
  parentId: z.string().nullish(),
  replyToSid: z.string().nullish(),
  /** 被 @ 回复的用户（后端 reply_to 联查），用于「回复 @某人」。 */
  replyTo: NoteAuthorSchema.nullish(),
  /** 评论图片（0~9 张）。`.default([])` 兼容不带该字段的旧/mock 载荷。 */
  images: z.array(z.string()).default([]),
  status: z.string().default('visible'),
  likes: z.number().int().nonnegative().default(0),
  dislikes: z.number().int().nonnegative().default(0),
  likedByMe: z.boolean().default(false),
  dislikedByMe: z.boolean().default(false),
  anchorText: z.string().nullish(),
  anchorOffsetStart: z.number().int().nullish(),
  anchorOffsetEnd: z.number().int().nullish(),
})
export type Comment = z.infer<typeof CommentSchema>

export const PaginatedCommentsSchema = z.object({
  items: z.array(CommentSchema),
  nextCursor: z.string().nullable(),
})
export type PaginatedComments = z.infer<typeof PaginatedCommentsSchema>

export type CommentIn = {
  content: string
  /** 楼内回复时带上顶层评论 id + 被回复用户 sid（后端限两层）。 */
  parentId?: string | null
  replyToSid?: string | null
  /** 评论图片 URL（≤9，先经上传接口拿到 URL）。 */
  images?: string[]
  anchorText?: string | null
  anchorOffsetStart?: number | null
  anchorOffsetEnd?: number | null
}
