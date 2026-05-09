import { describe, it, expect } from 'vitest'
import { CATEGORIES, getCategory, type CategoryId } from './categories'

const EXPECTED_IDS: CategoryId[] = [
  'research',
  'course',
  'recommend',
  'competition',
  'kaggle',
  'tools',
  'life',
]

describe('CATEGORIES', () => {
  it('contains exactly 7 entries in spec order', () => {
    expect(CATEGORIES).toHaveLength(7)
    expect(CATEGORIES.map((c) => c.id)).toEqual(EXPECTED_IDS)
  })

  it('uses the plural "tools" not singular "tool" (spec deviation #3)', () => {
    expect(CATEGORIES.map((c) => c.id)).toContain('tools')
    expect(CATEGORIES.map((c) => c.id)).not.toContain('tool' as never)
  })

  it('every entry has icon / colorVar / tagBgVar / desc', () => {
    for (const c of CATEGORIES) {
      expect(c.icon).toBeTruthy()
      expect(c.colorVar).toMatch(/^--cat-/)
      expect(c.tagBgVar).toMatch(/^--tag-.+-bg$/)
      expect(c.desc.length).toBeGreaterThan(0)
    }
  })

  it('colorVar matches the id', () => {
    for (const c of CATEGORIES) {
      expect(c.colorVar).toBe(`--cat-${c.id}`)
      expect(c.tagBgVar).toBe(`--tag-${c.id}-bg`)
    }
  })
})

describe('getCategory', () => {
  it('returns the matching category', () => {
    expect(getCategory('research').label).toBe('科研')
    expect(getCategory('kaggle').label).toBe('Kaggle')
    expect(getCategory('tools').label).toBe('工具')
  })

  it('throws for unknown id', () => {
    expect(() => getCategory('unknown' as CategoryId)).toThrow(/Unknown category id/)
  })
})
