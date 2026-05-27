import { request } from '../client'
import { ConferencesOutSchema, type ConferencesOut } from '../schemas/conference'

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function getConferences(): Promise<ConferencesOut> {
  return request({
    method: 'GET',
    path: '/conferences/list',
    schema: ConferencesOutSchema,
    headers: authHeaders(),
  })
}
