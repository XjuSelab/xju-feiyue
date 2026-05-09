import { describe, it, expect } from 'vitest'
import {
  AIComposeModeSchema,
  AIComposeRequestSchema,
  AIComposeResponseSchema,
  DiffSegmentSchema,
} from './ai'

describe('AIComposeModeSchema', () => {
  it.each(['polish', 'shorten', 'expand', 'tone', 'translate', 'custom'] as const)(
    'accepts %s',
    (mode) => {
      expect(() => AIComposeModeSchema.parse(mode)).not.toThrow()
    },
  )

  it('rejects unknown mode', () => {
    expect(() => AIComposeModeSchema.parse('summarize')).toThrow()
  })
})

describe('AIComposeRequestSchema', () => {
  it('requires non-empty text', () => {
    expect(() => AIComposeRequestSchema.parse({ mode: 'polish', text: 'x' })).not.toThrow()
    expect(() => AIComposeRequestSchema.parse({ mode: 'polish', text: '' })).toThrow()
  })

  it('options is optional', () => {
    expect(() => AIComposeRequestSchema.parse({ mode: 'tone', text: 'x' })).not.toThrow()
    expect(() =>
      AIComposeRequestSchema.parse({
        mode: 'tone',
        text: 'x',
        options: { target: 'formal' },
      }),
    ).not.toThrow()
  })
})

describe('DiffSegmentSchema', () => {
  it.each(['equal', 'add', 'del'] as const)('accepts type %s', (type) => {
    expect(() => DiffSegmentSchema.parse({ type, text: 'x' })).not.toThrow()
  })

  it('rejects unknown type', () => {
    expect(() => DiffSegmentSchema.parse({ type: 'modify', text: 'x' })).toThrow()
  })
})

describe('AIComposeResponseSchema', () => {
  it('parses a full response', () => {
    expect(() =>
      AIComposeResponseSchema.parse({
        segments: [
          { type: 'equal', text: 'a' },
          { type: 'add', text: 'b' },
        ],
        before: 'a',
        after: 'ab',
        elapsedMs: 800,
      }),
    ).not.toThrow()
  })

  it('rejects negative elapsedMs', () => {
    expect(() =>
      AIComposeResponseSchema.parse({
        segments: [],
        before: '',
        after: '',
        elapsedMs: -1,
      }),
    ).toThrow()
  })
})
