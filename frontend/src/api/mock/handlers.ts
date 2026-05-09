/**
 * Mock dispatch table for dev. Loaded once at app boot via api/index.ts.
 * R3 注册了 auth；R4 home-agent 扩 notes；R4 editor-agent 在 ai.ts handler
 * step 扩 ai。
 */
import { ApiError, registerMock, type MockReq } from '../client'
import { NoteSchema, type Note, type ListNotesQuery } from '../schemas/note'
import notesFixture from './notes.json'

// ============== auth ==============

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
  const body = req.body as { sid?: string; password?: string } | undefined
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

// ============== notes ==============

// Validate fixtures at load time — fail fast if JSON drifts from schema.
const ALL_NOTES: Note[] = (notesFixture as unknown[]).map((n) =>
  NoteSchema.parse(n),
)

const DEFAULT_LIMIT = 6
const MAX_LIMIT = 50

function parseListQuery(req: MockReq): ListNotesQuery {
  const q: ListNotesQuery = {}
  const cat = req.query.get('cat')
  if (cat) q.cat = cat as ListNotesQuery['cat']
  const text = req.query.get('q')
  if (text) q.q = text
  const sort = req.query.get('sort')
  if (sort === 'latest' || sort === 'hot' || sort === 'liked') q.sort = sort
  const cursor = req.query.get('cursor')
  if (cursor) q.cursor = cursor
  const limitStr = req.query.get('limit')
  if (limitStr) {
    const n = Number(limitStr)
    if (Number.isInteger(n) && n > 0) q.limit = Math.min(n, MAX_LIMIT)
  }
  const tagsStr = req.query.get('tags')
  if (tagsStr) {
    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tags.length > 0) q.tags = tags
  }
  return q
}

function filterAndSort(query: ListNotesQuery): Note[] {
  let result = ALL_NOTES.slice()
  if (query.cat) {
    result = result.filter((n) => n.category === query.cat)
  }
  if (query.q) {
    const needle = query.q.toLowerCase()
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(needle) ||
        n.summary.toLowerCase().includes(needle) ||
        n.tags.some((t) => t.toLowerCase().includes(needle)),
    )
  }
  if (query.tags && query.tags.length > 0) {
    const wanted = new Set(query.tags)
    result = result.filter((n) => n.tags.some((t) => wanted.has(t)))
  }
  if (query.sort === 'hot' || query.sort === 'liked') {
    result.sort((a, b) => b.likes - a.likes)
  } else {
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return result
}

registerMock('GET', '/notes', async (req: MockReq) => {
  const q = parseListQuery(req)
  const list = filterAndSort(q)
  const limit = q.limit ?? DEFAULT_LIMIT
  const startIdx = q.cursor
    ? list.findIndex((n) => n.id === q.cursor) + 1
    : 0
  const items = list.slice(startIdx, startIdx + limit)
  const lastItem = items.at(-1)
  const nextCursor =
    startIdx + limit < list.length && lastItem ? lastItem.id : null
  return { items, nextCursor }
})

registerMock('GET', '/notes/hot', async () => {
  return ALL_NOTES.slice()
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
    .slice(0, 6)
})

registerMock('GET', '/notes/latest', async () => {
  return ALL_NOTES.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
})

registerMock('GET', '/notes/liked', async () => {
  return ALL_NOTES.slice()
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 6)
})

registerMock('GET', '/notes/get', async (req: MockReq) => {
  const id = req.query.get('id')
  const note = ALL_NOTES.find((n) => n.id === id)
  if (!note) throw new ApiError('笔记不存在', 404, req.path)
  return note
})
