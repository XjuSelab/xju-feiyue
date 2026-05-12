import { z } from 'zod'
import { request } from '../client'

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
