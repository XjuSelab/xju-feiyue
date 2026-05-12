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
  anchorText?: string | null
  anchorOffsetStart?: number | null
  anchorOffsetEnd?: number | null
}
