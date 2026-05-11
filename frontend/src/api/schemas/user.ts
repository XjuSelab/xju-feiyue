import { z } from 'zod'

/**
 * UserSchema mirrors the backend UserOut: sid is the PK, nickname is what
 * cards / detail pages render, name is the legal name (mostly hidden).
 * Contact fields (wechat/phone/email) are only populated when the row is
 * the *current* user (returned from /auth/me).
 */
export const UserSchema = z.object({
  sid: z.string(),
  name: z.string(),
  nickname: z.string(),
  avatar: z.string().url().nullish(),
  /** Server-side downscale (~160 px). Prefer this for tiny chips. */
  avatarThumb: z.string().url().nullish(),
  bio: z.string().nullish(),
  wechat: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
})
export type User = z.infer<typeof UserSchema>

export const LoginResponseSchema = z.object({
  user: UserSchema,
  token: z.string().min(1),
})
export type LoginResponse = z.infer<typeof LoginResponseSchema>

export const LoginRequestSchema = z.object({
  sid: z.string().regex(/^\d{11}$/, '学号需 11 位纯数字'),
  password: z.string().min(1, '密码不能为空'),
})
export type LoginRequest = z.infer<typeof LoginRequestSchema>

/** PATCH /auth/me body — every field optional, missing = unchanged. */
export const UserMeUpdateSchema = z.object({
  nickname: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).optional(),
  wechat: z.string().max(64).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().max(128).optional(),
})
export type UserMeUpdate = z.infer<typeof UserMeUpdateSchema>

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码至少 6 位').max(128),
})
export type PasswordChange = z.infer<typeof PasswordChangeSchema>
