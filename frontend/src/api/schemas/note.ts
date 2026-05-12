import { z } from 'zod'

/**
 * R4 共享的 Note 接口契约。R3 末尾在 contracts step 冻结，
 * R4 4 个 subagent 不允许擅改字段，必须在 schema 上扩展再统一推进。
 */

export const CATEGORY_IDS = [
  'research',
  'course',
  'recommend',
  'competition',
  'kaggle',
  'tools',
  'life',
] as const
export const CategoryIdSchema = z.enum(CATEGORY_IDS)

export const NoteAuthorSchema = z.object({
  sid: z.string(),
  nickname: z.string(),
  avatar: z.string().url().nullish(),
  /** Server-side downscale (~160 px). Prefer this for tiny chips. */
  avatarThumb: z.string().url().nullish(),
})
export type NoteAuthor = z.infer<typeof NoteAuthorSchema>

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  /** Markdown body. Empty string for legacy notes that have no body yet. */
  content: z.string(),
  cover: z.string().url().nullish(),
  category: CategoryIdSchema,
  tags: z.array(z.string()),
  author: NoteAuthorSchema,
  /** ISO 8601 timestamp */
  createdAt: z.string(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  /** estimated read time in minutes */
  readMinutes: z.number().int().positive(),
  /** Whether the current viewer has liked this note. Anon viewers see false. */
  likedByMe: z.boolean(),
})
export type Note = z.infer<typeof NoteSchema>

/** Body shape for PATCH /notes/{id} — all fields optional. */
export type NoteUpdateIn = {
  title?: string
  content?: string
  category?: z.infer<typeof CategoryIdSchema>
  tags?: string[]
}

export const NoteListSchema = z.array(NoteSchema)

/** 浏览页查询参数 schema（R4 browse-agent 复用） */
export const ListNotesQuerySchema = z.object({
  cat: CategoryIdSchema.optional(),
  q: z.string().optional(),
  sort: z.enum(['latest', 'hot', 'liked']).optional(),
  tags: z.array(z.string()).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
  /** Restrict to the authenticated user's own notes (sent with auth header). */
  mine: z.boolean().optional(),
})
export type ListNotesQuery = z.infer<typeof ListNotesQuerySchema>

export const PaginatedNotesSchema = z.object({
  items: NoteListSchema,
  nextCursor: z.string().nullable(),
})
export type PaginatedNotes = z.infer<typeof PaginatedNotesSchema>
