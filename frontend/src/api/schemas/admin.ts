import { z } from 'zod'

/**
 * Mirrors backend app/schemas/admin.py (camelCase wire format). Admin-only
 * payloads — `AdminUserRow` carries contact + audit fields the public
 * UserSchema never leaks, because only admins ever see this surface.
 */

export const RoleSchema = z.enum(['user', 'admin', 'superadmin'])
export type Role = z.infer<typeof RoleSchema>

/** Roles a super-admin may assign via the UI ('superadmin' is bootstrap-only). */
export const AssignableRoleSchema = z.enum(['user', 'admin'])
export type AssignableRole = z.infer<typeof AssignableRoleSchema>

export const AdminUserRowSchema = z.object({
  sid: z.string(),
  name: z.string(),
  nickname: z.string(),
  role: RoleSchema,
  email: z.string().nullish(),
  phone: z.string().nullish(),
  avatarThumb: z.string().url().nullish(),
  noteCount: z.number(),
  materialCount: z.number(),
  /** ISO-8601 UTC (…Z) or null. */
  lastLoginAt: z.string().nullish(),
  createdAt: z.string().nullish(),
})
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>

export const RoleCountSchema = z.object({ role: z.string(), count: z.number() })
export const DayCountSchema = z.object({ date: z.string(), count: z.number() })
export const TopUploaderSchema = z.object({
  sid: z.string(),
  nickname: z.string(),
  fileCount: z.number(),
  sizeBytes: z.number(),
})
export const RecentSignupSchema = z.object({
  sid: z.string(),
  nickname: z.string(),
  role: z.string(),
  createdAt: z.string().nullish(),
})

export const AdminStatsSchema = z.object({
  totalUsers: z.number(),
  totalAdmins: z.number(),
  totalNotes: z.number(),
  totalResources: z.number(),
  totalFiles: z.number(),
  totalStorageBytes: z.number(),
  loginsToday: z.number(),
  roleBreakdown: z.array(RoleCountSchema),
  loginActivity: z.array(DayCountSchema),
  topUploaders: z.array(TopUploaderSchema),
  recentSignups: z.array(RecentSignupSchema),
})
export type AdminStats = z.infer<typeof AdminStatsSchema>

export const ResetPasswordOutSchema = z.object({
  sid: z.string(),
  password: z.string(),
})
export type ResetPasswordOut = z.infer<typeof ResetPasswordOutSchema>

/** GET /admin/login-events row — who logged in, when, from where. */
export const LoginEventSchema = z.object({
  id: z.number(),
  sid: z.string(),
  nickname: z.string(),
  name: z.string(),
  ip: z.string(),
  userAgent: z.string().nullish(),
  /** ISO-8601 UTC (…Z). */
  at: z.string(),
})
export type LoginEvent = z.infer<typeof LoginEventSchema>

/** POST /admin/users body. */
export const UserCreateSchema = z.object({
  sid: z.string().regex(/^\d{11}$/, '学号需 11 位纯数字'),
  name: z.string().min(1, '姓名不能为空').max(120),
  preferredName: z.string().min(1).max(120).optional(),
  password: z.string().min(6, '密码至少 6 位').max(128).optional(),
})
export type UserCreate = z.infer<typeof UserCreateSchema>
