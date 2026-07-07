import { z } from 'zod'
import { request } from '../client'
import {
  CollectionDetailSchema,
  CollectionListSchema,
  CollectionSchema,
  NoteCollectionContextSchema,
  type Collection,
  type CollectionCreateIn,
  type CollectionDetail,
  type CollectionUpdateIn,
  type NoteCollectionContext,
} from '../schemas/collection'

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function listMine(): Promise<Collection[]> {
  return request({
    method: 'GET',
    path: '/collections/mine',
    schema: CollectionListSchema,
    headers: authHeaders(),
  })
}

export async function getDetail(id: string): Promise<CollectionDetail> {
  return request({ method: 'GET', path: `/collections/${id}`, schema: CollectionDetailSchema })
}

export async function create(body: CollectionCreateIn): Promise<Collection> {
  return request({
    method: 'POST',
    path: '/collections',
    body,
    schema: CollectionSchema,
    headers: authHeaders(),
  })
}

export async function update(id: string, body: CollectionUpdateIn): Promise<Collection> {
  return request({
    method: 'PATCH',
    path: `/collections/${id}`,
    body,
    schema: CollectionSchema,
    headers: authHeaders(),
  })
}

export async function remove(id: string): Promise<void> {
  await request({
    method: 'DELETE',
    path: `/collections/${id}`,
    schema: z.null(),
    headers: authHeaders(),
  })
}

export async function addEntry(
  id: string,
  noteId: string,
  sortOrder?: number,
): Promise<CollectionDetail> {
  return request({
    method: 'POST',
    path: `/collections/${id}/entries`,
    body: { noteId, ...(sortOrder !== undefined ? { sortOrder } : {}) },
    schema: CollectionDetailSchema,
    headers: authHeaders(),
  })
}

export async function removeEntry(id: string, noteId: string): Promise<void> {
  await request({
    method: 'DELETE',
    path: `/collections/${id}/entries/${noteId}`,
    schema: z.null(),
    headers: authHeaders(),
  })
}

export async function reorderEntries(id: string, noteIds: string[]): Promise<CollectionDetail> {
  return request({
    method: 'PATCH',
    path: `/collections/${id}/entries/order`,
    body: { noteIds },
    schema: CollectionDetailSchema,
    headers: authHeaders(),
  })
}

export async function getNoteCollection(noteId: string): Promise<NoteCollectionContext | null> {
  return request({
    method: 'GET',
    path: `/notes/${noteId}/collection`,
    schema: NoteCollectionContextSchema.nullable(),
  })
}
