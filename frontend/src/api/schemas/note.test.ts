import { describe, it, expect } from 'vitest'
import { NoteSchema, NoteListSchema, ListNotesQuerySchema, PaginatedNotesSchema } from './note'

const VALID_NOTE = {
  id: 'n1',
  title: 'Hello',
  summary: 'A note',
  category: 'research' as const,
  tags: ['paper'],
  author: { id: 'u1', name: 'Alice' },
  createdAt: '2026-05-09T00:00:00Z',
  likes: 10,
  comments: 2,
  readMinutes: 5,
}

describe('NoteSchema', () => {
  it('accepts a minimal valid note', () => {
    expect(() => NoteSchema.parse(VALID_NOTE)).not.toThrow()
  })

  it('rejects unknown category', () => {
    expect(() => NoteSchema.parse({ ...VALID_NOTE, category: 'unknown' })).toThrow()
  })

  it('rejects negative likes', () => {
    expect(() => NoteSchema.parse({ ...VALID_NOTE, likes: -1 })).toThrow()
  })

  it('rejects non-integer readMinutes', () => {
    expect(() => NoteSchema.parse({ ...VALID_NOTE, readMinutes: 1.5 })).toThrow()
  })

  it('rejects readMinutes ≤ 0', () => {
    expect(() => NoteSchema.parse({ ...VALID_NOTE, readMinutes: 0 })).toThrow()
  })

  it('accepts optional cover URL', () => {
    expect(() =>
      NoteSchema.parse({
        ...VALID_NOTE,
        cover: 'https://example.com/c.png',
      }),
    ).not.toThrow()
  })

  it('rejects non-URL cover', () => {
    expect(() => NoteSchema.parse({ ...VALID_NOTE, cover: 'not-a-url' })).toThrow()
  })

  it('NoteListSchema parses array of notes', () => {
    expect(() => NoteListSchema.parse([VALID_NOTE, VALID_NOTE])).not.toThrow()
  })
})

describe('ListNotesQuerySchema', () => {
  it('accepts empty query', () => {
    expect(() => ListNotesQuerySchema.parse({})).not.toThrow()
  })

  it('accepts known sort values', () => {
    expect(() => ListNotesQuerySchema.parse({ sort: 'latest' })).not.toThrow()
    expect(() => ListNotesQuerySchema.parse({ sort: 'hot' })).not.toThrow()
    expect(() => ListNotesQuerySchema.parse({ sort: 'liked' })).not.toThrow()
  })

  it('rejects unknown sort', () => {
    expect(() => ListNotesQuerySchema.parse({ sort: 'random' })).toThrow()
  })

  it('limit must be positive integer ≤ 50', () => {
    expect(() => ListNotesQuerySchema.parse({ limit: 50 })).not.toThrow()
    expect(() => ListNotesQuerySchema.parse({ limit: 0 })).toThrow()
    expect(() => ListNotesQuerySchema.parse({ limit: 51 })).toThrow()
    expect(() => ListNotesQuerySchema.parse({ limit: 1.5 })).toThrow()
  })
})

describe('PaginatedNotesSchema', () => {
  it('accepts items + nextCursor null', () => {
    expect(() =>
      PaginatedNotesSchema.parse({ items: [VALID_NOTE], nextCursor: null }),
    ).not.toThrow()
  })

  it('accepts items + string cursor', () => {
    expect(() =>
      PaginatedNotesSchema.parse({
        items: [VALID_NOTE],
        nextCursor: 'cur_xyz',
      }),
    ).not.toThrow()
  })

  it('rejects missing nextCursor field', () => {
    expect(() => PaginatedNotesSchema.parse({ items: [VALID_NOTE] })).toThrow()
  })
})
