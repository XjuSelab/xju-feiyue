/**
 * 数据层公共出口。importing this file (or anything from `@/api`) loads the
 * mock dispatch table in dev. Prod builds tree-shake the dev branch via
 * `import.meta.env.DEV`.
 *
 * R3 只暴露 auth；R4 contracts step 会扩出 notes/ai endpoints + TanStack Query
 * hooks。
 */

if (import.meta.env.DEV) {
  // Side-effect import; handlers register on module load.
  await import('./mock/handlers')
}

export { request, registerMock, ApiError } from './client'
export type { HttpMethod, MockHandler, MockReq } from './client'

export * as authApi from './endpoints/auth'
export {
  UserSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  type User,
  type LoginRequest,
  type LoginResponse,
} from './schemas/user'
