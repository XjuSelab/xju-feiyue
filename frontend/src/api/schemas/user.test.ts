import { describe, it, expect } from 'vitest'
import { LoginRequestSchema, LoginResponseSchema, UserSchema } from './user'

describe('UserSchema', () => {
  it('accepts a minimal user', () => {
    expect(() => UserSchema.parse({ id: 'u1', sid: '20211010001', name: 'Alice' })).not.toThrow()
  })

  it('accepts optional avatar URL and bio', () => {
    expect(() =>
      UserSchema.parse({
        id: 'u1',
        sid: '20211010001',
        name: 'Alice',
        avatar: 'https://example.com/a.png',
        bio: 'hello',
      }),
    ).not.toThrow()
  })

  it('rejects non-URL avatar', () => {
    expect(() =>
      UserSchema.parse({
        id: 'u1',
        sid: '20211010001',
        name: 'Alice',
        avatar: 'not-a-url',
      }),
    ).toThrow()
  })
})

describe('LoginRequestSchema', () => {
  it('accepts exactly 11-digit sid + non-empty password', () => {
    expect(() => LoginRequestSchema.parse({ sid: '20211010001', password: '123456' })).not.toThrow()
    expect(() => LoginRequestSchema.parse({ sid: '12345678901', password: 'x' })).not.toThrow()
  })

  it('rejects sid shorter than 11 digits', () => {
    expect(() => LoginRequestSchema.parse({ sid: '2021001', password: 'x' })).toThrow(/11/)
  })

  it('rejects sid longer than 11 digits', () => {
    expect(() => LoginRequestSchema.parse({ sid: '202110100012', password: 'x' })).toThrow(/11/)
  })

  it('rejects sid with non-digit characters', () => {
    expect(() => LoginRequestSchema.parse({ sid: '2021101000a', password: 'x' })).toThrow()
  })

  it('rejects empty password', () => {
    expect(() => LoginRequestSchema.parse({ sid: '20211010001', password: '' })).toThrow()
  })
})

describe('LoginResponseSchema', () => {
  it('requires user + token', () => {
    expect(() =>
      LoginResponseSchema.parse({
        user: { id: 'u1', sid: '20211010001', name: 'A' },
        token: 'abc',
      }),
    ).not.toThrow()
  })

  it('rejects empty token', () => {
    expect(() =>
      LoginResponseSchema.parse({
        user: { id: 'u1', sid: '20211010001', name: 'A' },
        token: '',
      }),
    ).toThrow()
  })
})
