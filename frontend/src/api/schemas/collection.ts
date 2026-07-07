import { z } from 'zod'
import { CategoryIdSchema, NoteAuthorSchema } from './note'

/** A note as it appears inside a collection (mirror of backend CollectionNoteOut). */
export const CollectionNoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  category: CategoryIdSchema,
  createdAt: z.string(),
  readMinutes: z.number().int().positive(),
  author: NoteAuthorSchema,
})
export type CollectionNote = z.infer<typeof CollectionNoteSchema>

/** Mirror of backend CollectionOut. */
export const CollectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  entryCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Collection = z.infer<typeof CollectionSchema>

export const CollectionListSchema = z.array(CollectionSchema)

/** Mirror of backend CollectionDetailOut (collection + ordered entries). */
export const CollectionDetailSchema = CollectionSchema.extend({
  entries: z.array(CollectionNoteSchema).default([]),
})
export type CollectionDetail = z.infer<typeof CollectionDetailSchema>

/** GET /notes/{id}/collection — sidebar context. */
export const NoteCollectionContextSchema = z.object({
  collection: CollectionSchema,
  entries: z.array(CollectionNoteSchema),
  currentIndex: z.number().int(),
})
export type NoteCollectionContext = z.infer<typeof NoteCollectionContextSchema>

export type CollectionCreateIn = { title: string; description?: string }
export type CollectionUpdateIn = { title?: string; description?: string }
