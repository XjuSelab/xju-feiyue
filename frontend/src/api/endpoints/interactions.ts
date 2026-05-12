import { z } from 'zod'
import { request } from '../client'
import {
  CommentSchema,
  PaginatedCommentsSchema,
  type Comment,
  type CommentIn,
  type PaginatedComments,
} from '../schemas/interaction'

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function likeNote(id: string): Promise<void> {
  await request({
    method: 'POST',
    path: `/notes/${id}/like`,
    schema: z.null(),
    headers: authHeaders(),
  })
}

export async function unlikeNote(id: string): Promise<void> {
  await request({
    method: 'DELETE',
    path: `/notes/${id}/like`,
    schema: z.null(),
    headers: authHeaders(),
  })
}

export async function listComments(
  noteId: string,
  options?: { cursor?: string; limit?: number },
): Promise<PaginatedComments> {
  const query: Record<string, string | number | undefined> = {}
  if (options?.cursor) query['cursor'] = options.cursor
  if (typeof options?.limit === 'number') query['limit'] = options.limit
  return request({
    method: 'GET',
    path: `/notes/${noteId}/comments`,
    schema: PaginatedCommentsSchema,
    ...(Object.keys(query).length > 0 ? { query } : {}),
  })
}

export async function createComment(noteId: string, body: CommentIn): Promise<Comment> {
  return request({
    method: 'POST',
    path: `/notes/${noteId}/comments`,
    body,
    schema: CommentSchema,
    headers: authHeaders(),
  })
}

export async function deleteComment(noteId: string, commentId: string): Promise<void> {
  await request({
    method: 'DELETE',
    path: `/notes/${noteId}/comments/${commentId}`,
    schema: z.null(),
    headers: authHeaders(),
  })
}
