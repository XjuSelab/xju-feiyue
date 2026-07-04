import { z } from 'zod'

import { request } from '../client'
import {
  AdminClassSchema,
  AdminStatsSchema,
  AdminUserRowSchema,
  LoginEventSchema,
  ResetPasswordOutSchema,
  type AdminClass,
  type AdminClassCreate,
  type AdminStats,
  type AdminUserRow,
  type AssignableRole,
  type LoginEvent,
  type ResetPasswordOut,
  type UserCreate,
} from '../schemas/admin'
import { NoContentSchema } from '../schemas/material'

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

// ---------------------------------------------------------------------------
// 班级管理
// ---------------------------------------------------------------------------

/** GET /admin/classes — 全部班级 + 学生/班委计数（admin+）。 */
export async function listAdminClasses(): Promise<AdminClass[]> {
  return request({
    method: 'GET',
    path: '/admin/classes',
    schema: z.array(AdminClassSchema),
    headers: authHeaders(),
  })
}

/** POST /admin/classes — 新建班级（重名 409）。 */
export async function createAdminClass(body: AdminClassCreate): Promise<AdminClass> {
  return request({
    method: 'POST',
    path: '/admin/classes',
    body,
    schema: AdminClassSchema,
    headers: authHeaders(),
  })
}

/** DELETE /admin/classes/{id} — 删除空班级（仍有成员/小组 409）。 */
export async function deleteAdminClass(classId: number): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/admin/classes/${classId}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

/** POST /admin/users/{sid}/class — 设置/清除用户班级（清除同时摘班委）。 */
export async function setUserClass(sid: string, classId: number | null): Promise<AdminUserRow> {
  return request({
    method: 'POST',
    path: `/admin/users/${sid}/class`,
    body: { classId },
    schema: AdminUserRowSchema,
    headers: authHeaders(),
  })
}

/** POST /admin/users/{sid}/committee — 设/撤班委（须已有班级）。 */
export async function setUserCommittee(
  sid: string,
  isClassCommittee: boolean,
): Promise<AdminUserRow> {
  return request({
    method: 'POST',
    path: `/admin/users/${sid}/committee`,
    body: { isClassCommittee },
    schema: AdminUserRowSchema,
    headers: authHeaders(),
  })
}
