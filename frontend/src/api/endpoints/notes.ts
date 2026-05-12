import { z } from 'zod'
import { request } from '../client'
import {
  NoteListSchema,
  NoteSchema,
  PaginatedNotesSchema,
  type Note,
  type ListNotesQuery,
  type NoteUpdateIn,
  type PaginatedNotes,
} from '../schemas/note'

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/**
 * R4 home-agent 实现：所有函数走 client.request → mock dispatcher (dev) /
 * fetch (prod)，输入输出经 Zod schema 校验。R3 contracts 定义的签名不变。
 */

function toRequestQuery(
  q: ListNotesQuery | undefined,
): Record<string, string | number | undefined> | undefined {
  if (!q) return undefined
  const params: Record<string, string | number> = {}
  if (q.cat) params['cat'] = q.cat
  if (q.q) params['q'] = q.q
  if (q.sort) params['sort'] = q.sort
  if (q.cursor) params['cursor'] = q.cursor
  if (typeof q.limit === 'number') params['limit'] = q.limit
  if (q.tags && q.tags.length > 0) params['tags'] = q.tags.join(',')
  return params
}

export async function listNotes(query?: ListNotesQuery): Promise<PaginatedNotes> {
  const requestQuery = toRequestQuery(query)
  return request({
    method: 'GET',
    path: '/notes',
    schema: PaginatedNotesSchema,
    headers: authHeaders(),
    ...(requestQuery !== undefined ? { query: requestQuery } : {}),
  })
}

export async function getHotThisWeek(): Promise<Note[]> {
  return request({
    method: 'GET',
    path: '/notes/hot',
    schema: NoteListSchema,
    headers: authHeaders(),
  })
}

export async function getLatest(): Promise<Note[]> {
  return request({
    method: 'GET',
    path: '/notes/latest',
    schema: NoteListSchema,
    headers: authHeaders(),
  })
}

export async function getMostLiked(): Promise<Note[]> {
  return request({
    method: 'GET',
    path: '/notes/liked',
    schema: NoteListSchema,
    headers: authHeaders(),
  })
}

export async function getNote(id: string): Promise<Note> {
  return request({
    method: 'GET',
    path: '/notes/get',
    query: { id },
    schema: NoteSchema,
    headers: authHeaders(),
  })
}

export async function updateNote(id: string, body: NoteUpdateIn): Promise<Note> {
  return request({
    method: 'PATCH',
    path: `/notes/${id}`,
    body,
    schema: NoteSchema,
    headers: authHeaders(),
  })
}

export async function deleteNote(id: string): Promise<void> {
  await request({
    method: 'DELETE',
    path: `/notes/${id}`,
    schema: z.null(),
    headers: authHeaders(),
  })
}
