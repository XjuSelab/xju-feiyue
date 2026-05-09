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
  id: z.string(),
  name: z.string(),
  avatar: z.string().url().optional(),
})
export type NoteAuthor = z.infer<typeof NoteAuthorSchema>

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  cover: z.string().url().optional(),
  category: CategoryIdSchema,
  tags: z.array(z.string()),
  author: NoteAuthorSchema,
  /** ISO 8601 timestamp */
  createdAt: z.string(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  /** estimated read time in minutes */
  readMinutes: z.number().int().positive(),
})
export type Note = z.infer<typeof NoteSchema>

export const NoteListSchema = z.array(NoteSchema)

/** 浏览页查询参数 schema（R4 browse-agent 复用） */
export const ListNotesQuerySchema = z.object({
  cat: CategoryIdSchema.optional(),
  q: z.string().optional(),
  sort: z.enum(['latest', 'hot', 'liked']).optional(),
  tags: z.array(z.string()).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
})
export type ListNotesQuery = z.infer<typeof ListNotesQuerySchema>

export const PaginatedNotesSchema = z.object({
  items: NoteListSchema,
  nextCursor: z.string().nullable(),
})
export type PaginatedNotes = z.infer<typeof PaginatedNotesSchema>
