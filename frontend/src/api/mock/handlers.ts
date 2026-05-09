/**
 * Mock dispatch table for dev. Loaded once at app boot via api/index.ts.
 * R3 仅注册 auth handlers；R4 home-agent 起会 import 并注册 notes/ai handlers。
 */
import { ApiError, registerMock, type MockReq } from '../client'

const VALID_SID = '20210001'
const VALID_PASSWORD = '123456'
const TOKEN_PREFIX = 'mock-jwt-'

const FAKE_USER = {
  id: 'usr_zilun',
  sid: VALID_SID,
  name: 'Zilun Wei',
  bio: '科研笔记 + Kaggle 复盘',
}

registerMock('POST', '/auth/login', async (req: MockReq) => {
  const body = req.body as
    | { sid?: string; password?: string }
    | undefined
  if (
    !body ||
    body.sid !== VALID_SID ||
    body.password !== VALID_PASSWORD
  ) {
    throw new ApiError('学号或密码不正确', 401, req.path)
  }
  return {
    user: FAKE_USER,
    token: `${TOKEN_PREFIX}${Date.now()}`,
  }
})

registerMock('POST', '/auth/logout', async () => null)

registerMock('GET', '/auth/me', async (req: MockReq) => {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith(`Bearer ${TOKEN_PREFIX}`)) return null
  return FAKE_USER
})
