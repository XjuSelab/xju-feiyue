import { z } from 'zod'
import { request } from '../client'
import {
  UserSchema,
  LoginResponseSchema,
  type User,
  type LoginResponse,
} from '../schemas/user'

export const TOKEN_KEY = 'labnotes.auth.token'

export async function login(
  sid: string,
  password: string,
): Promise<LoginResponse> {
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
