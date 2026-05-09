import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { highlight } from './highlight'

describe('highlight', () => {
  it('returns the original string when query is empty', () => {
    expect(highlight('hello world', '')).toBe('hello world')
    expect(highlight('hello world', '   ')).toBe('hello world')
  })

  it('wraps a single match in <mark>', () => {
    render(<div data-testid="out">{highlight('hello world', 'world')}</div>)
    const marks = screen.getAllByText('world')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.tagName).toBe('MARK')
  })

  it('matches case-insensitively but preserves original case', () => {
    render(<div data-testid="out">{highlight('Hello WORLD', 'hello')}</div>)
    const mark = screen.getByText('Hello')
    expect(mark.tagName).toBe('MARK')
  })

  it('highlights multiple occurrences', () => {
    render(<div data-testid="out">{highlight('aa bb aa cc aa', 'aa')}</div>)
    const marks = screen.getAllByText('aa')
    expect(marks).toHaveLength(3)
    expect(marks.every((m) => m.tagName === 'MARK')).toBe(true)
  })

  it('escapes regex special characters in query', () => {
    render(<div data-testid="out">{highlight('foo (bar) baz', '(bar)')}</div>)
    expect(screen.getByText('(bar)').tagName).toBe('MARK')
  })

  it('highlights Chinese substrings', () => {
    render(<div data-testid="out">{highlight('实验室经验共享', '经验')}</div>)
    expect(screen.getByText('经验').tagName).toBe('MARK')
  })

  it('returns plain text wrapped in fragment when no match', () => {
    render(<div data-testid="out">{highlight('hello world', 'xyz')}</div>)
    expect(screen.getByTestId('out').textContent).toBe('hello world')
    expect(screen.queryByText('hello world')).toBeTruthy()
  })
})
