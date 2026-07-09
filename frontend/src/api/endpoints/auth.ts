import { z } from 'zod'
import { request } from '../client'
import {
  UserSchema,
  LoginResponseSchema,
  type User,
  type LoginResponse,
  type UserMeUpdate,
  type PasswordChange,
} from '../schemas/user'
import {
  CheckInSchema,
  XpEventListSchema,
  type CheckIn,
  type XpEvent,
} from '../schemas/growth'

export const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function login(sid: string, password: string): Promise<LoginResponse> {
  return request({
    method: 'POST',
    path: '/auth/login',
    body: { sid, password },
    schema: LoginResponseSchema,
  })
}

export async function logout(): Promise<void> {
  await request({
    method: 'POST',
    path: '/auth/logout',
    schema: z.null(),
  })
}

export async function me(token: string): Promise<User | null> {
  return request({
    method: 'GET',
    path: '/auth/me',
    schema: UserSchema.nullable(),
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function updateMe(body: UserMeUpdate): Promise<User> {
  return request({
    method: 'PATCH',
    path: '/auth/me',
    body,
    schema: UserSchema,
    headers: authHeaders(),
  })
}

export async function changePassword(body: PasswordChange): Promise<void> {
  await request({
    method: 'POST',
    path: '/auth/me/password',
    body,
    schema: z.null(),
    headers: authHeaders(),
  })
}

/** POST /auth/me/checkin — daily check-in; idempotent (alreadyCheckedIn). */
export async function checkin(): Promise<CheckIn> {
  return request({
    method: 'POST',
    path: '/auth/me/checkin',
    schema: CheckInSchema,
    headers: authHeaders(),
  })
}

/** GET /auth/me/xp-events — recent experience ledger, newest first. */
export async function xpEvents(): Promise<XpEvent[]> {
  return request({
    method: 'GET',
    path: '/auth/me/xp-events',
    schema: XpEventListSchema,
    headers: authHeaders(),
  })
}

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData()
  form.append('file', file)
  return request({
    method: 'POST',
    path: '/auth/me/avatar',
    body: form,
    schema: UserSchema,
    headers: authHeaders(),
  })
}
