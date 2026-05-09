import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string(),
  sid: z.string(),
  name: z.string(),
  avatar: z.string().url().optional(),
  bio: z.string().optional(),
})
export type User = z.infer<typeof UserSchema>

export const LoginResponseSchema = z.object({
  user: UserSchema,
  token: z.string().min(1),
})
export type LoginResponse = z.infer<typeof LoginResponseSchema>

export const LoginRequestSchema = z.object({
  sid: z
    .string()
    .regex(/^\d{8,12}$/, '学号需 8-12 位纯数字'),
  password: z.string().min(1, '密码不能为空'),
})
export type LoginRequest = z.infer<typeof LoginRequestSchema>
