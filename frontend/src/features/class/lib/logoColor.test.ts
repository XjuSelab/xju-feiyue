import { describe, expect, it } from 'vitest'

import { LOGO_PALETTE, logoColor, logoInitials } from './logoColor'

describe('logoColor', () => {
  it('is deterministic for the same gid', () => {
    expect(logoColor('grp_0001')).toBe(logoColor('grp_0001'))
  })

  it('always returns a palette entry', () => {
    for (const gid of ['a', 'grp_0001', 'ffffffff', '小组', '']) {
      expect(LOGO_PALETTE).toContain(logoColor(gid))
    }
  })
})

describe('logoInitials', () => {
  it('takes the first two characters (CJK-aware)', () => {
    expect(logoInitials('飞跃小队')).toBe('飞跃')
    expect(logoInitials('AB team')).toBe('AB')
    expect(logoInitials('组')).toBe('组')
  })

  it('falls back for blank names', () => {
    expect(logoInitials('  ')).toBe('组')
  })
})
