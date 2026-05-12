import { z } from 'zod'
import { request } from '../client'
import { CategoryIdSchema, NoteSchema, type Note } from '../schemas/note'

export const DraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: CategoryIdSchema.nullable(),
  tags: z.array(z.string()),
  updatedAt: z.string(),
})
export type Draft = z.infer<typeof DraftSchema>

export type DraftIn = {
  title?: string
  content?: string
  category?: z.infer<typeof CategoryIdSchema> | null
  tags?: string[]
}

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function createDraft(body: DraftIn): Promise<Draft> {
  return request({
    method: 'POST',
    path: '/notes/drafts',
    body,
    schema: DraftSchema,
    headers: authHeaders(),
  })
}

export async function updateDraft(id: string, body: DraftIn): Promise<Draft> {
  return request({
    method: 'PATCH',
    path: `/notes/drafts/${id}`,
    body,
    schema: DraftSchema,
    headers: authHeaders(),
  })
}

export async function deleteDraft(id: string): Promise<void> {
  await request({
    method: 'DELETE',
    path: `/notes/drafts/${id}`,
    schema: z.null(),
    headers: authHeaders(),
  })
}

export async function publishDraft(id: string): Promise<Note> {
  return request({
    method: 'POST',
    path: `/notes/drafts/${id}/publish`,
    schema: NoteSchema,
    headers: authHeaders(),
  })
}
