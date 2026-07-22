import { describe, expect, it } from 'vitest'

import { AdminUserRowSchema } from './admin'

describe('AdminUserRowSchema', () => {
  it('requires and preserves the laboratory membership flag', () => {
    const row = AdminUserRowSchema.parse({
      sid: '20211010001',
      name: 'Alice',
      nickname: '小A',
      role: 'user',
      isLabMember: true,
      noteCount: 0,
      materialCount: 0,
    })

    expect(row.isLabMember).toBe(true)
    expect(() =>
      AdminUserRowSchema.parse({
        sid: '20211010001',
        name: 'Alice',
        nickname: '小A',
        role: 'user',
        noteCount: 0,
        materialCount: 0,
      }),
    ).toThrow()
  })
})
