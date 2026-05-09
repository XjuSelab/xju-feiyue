import { request } from '../client'
import {
  NoteListSchema,
  NoteSchema,
  PaginatedNotesSchema,
  type Note,
  type ListNotesQuery,
  type PaginatedNotes,
} from '../schemas/note'

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

export async function listNotes(
  query?: ListNotesQuery,
): Promise<PaginatedNotes> {
  const requestQuery = toRequestQuery(query)
  return request({
    method: 'GET',
    path: '/notes',
    schema: PaginatedNotesSchema,
    ...(requestQuery !== undefined ? { query: requestQuery } : {}),
  })
}

export async function getHotThisWeek(): Promise<Note[]> {
  return request({
    method: 'GET',
    path: '/notes/hot',
    schema: NoteListSchema,
  })
}

export async function getLatest(): Promise<Note[]> {
  return request({
    method: 'GET',
    path: '/notes/latest',
    schema: NoteListSchema,
  })
}

export async function getMostLiked(): Promise<Note[]> {
  return request({
    method: 'GET',
    path: '/notes/liked',
    schema: NoteListSchema,
  })
}

export async function getNote(id: string): Promise<Note> {
  return request({
    method: 'GET',
    path: '/notes/get',
    query: { id },
    schema: NoteSchema,
  })
}
