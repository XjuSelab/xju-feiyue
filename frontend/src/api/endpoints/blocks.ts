import { z } from 'zod'
import { request } from '../client'
import { BlockListSchema, type Block } from '../schemas/report'

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function blockUser(sid: string): Promise<void> {
  await request({ method: 'POST', path: `/blocks/${sid}`, schema: z.null(), headers: authHeaders() })
}

export async function unblockUser(sid: string): Promise<void> {
  await request({
    method: 'DELETE',
    path: `/blocks/${sid}`,
    schema: z.null(),
    headers: authHeaders(),
  })
}

export async function listBlocks(): Promise<Block[]> {
  return request({ method: 'GET', path: '/blocks', schema: BlockListSchema, headers: authHeaders() })
}
