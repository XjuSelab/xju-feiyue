import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins simple class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('handles conditional object syntax', () => {
    expect(cn('a', { b: true, c: false }, 'd')).toBe('a b d')
  })

  it('handles array nesting', () => {
    expect(cn(['a', 'b'], ['c'])).toBe('a b c')
  })

  it('merges conflicting Tailwind utilities (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('keeps non-conflicting utilities', () => {
    expect(cn('p-4 m-2')).toBe('p-4 m-2')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })
})
