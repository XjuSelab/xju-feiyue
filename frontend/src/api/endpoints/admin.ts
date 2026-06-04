import { z } from 'zod'

import { request } from '../client'
import {
  AdminStatsSchema,
  AdminUserRowSchema,
  LoginEventSchema,
  ResetPasswordOutSchema,
  type AdminStats,
  type AdminUserRow,
  type AssignableRole,
  type LoginEvent,
  type ResetPasswordOut,
  type UserCreate,
} from '../schemas/admin'

// Local auth-header helper (same TOKEN_KEY convention as other endpoint files).
const TOKEN_KEY = 'labnotes.auth.token'
function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** GET /admin/users — full roster + per-user counts + last login (admin+). */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  return request({
    method: 'GET',
    path: '/admin/users',
    schema: z.array(AdminUserRowSchema),
    headers: authHeaders(),
  })
}

/** GET /admin/stats — dashboard aggregates (admin+). */
export async function getAdminStats(): Promise<AdminStats> {
  return request({
    method: 'GET',
    path: '/admin/stats',
    schema: AdminStatsSchema,
    headers: authHeaders(),
  })
}

/** POST /admin/users — import a single user (admin+). 409 if sid exists. */
export async function createAdminUser(body: UserCreate): Promise<AdminUserRow> {
  return request({
    method: 'POST',
    path: '/admin/users',
    body,
    schema: AdminUserRowSchema,
    headers: authHeaders(),
  })
}

/** POST /admin/users/{sid}/reset-password — omit password ⇒ default 123456. */
export async function resetUserPassword(
  sid: string,
  password?: string,
): Promise<ResetPasswordOut> {
  return request({
    method: 'POST',
    path: `/admin/users/${sid}/reset-password`,
    body: password ? { password } : {},
    schema: ResetPasswordOutSchema,
    headers: authHeaders(),
  })
}

/** GET /admin/login-events — recent successful logins (admin+). */
export async function listLoginEvents(limit = 12): Promise<LoginEvent[]> {
  return request({
    method: 'GET',
    path: '/admin/login-events',
    query: { limit },
    schema: z.array(LoginEventSchema),
    headers: authHeaders(),
  })
}

/** POST /admin/users/{sid}/role — promote/demote (super-admin only). */
export async function setUserRole(
  sid: string,
  role: AssignableRole,
): Promise<AdminUserRow> {
  return request({
    method: 'POST',
    path: `/admin/users/${sid}/role`,
    body: { role },
    schema: AdminUserRowSchema,
    headers: authHeaders(),
  })
}
