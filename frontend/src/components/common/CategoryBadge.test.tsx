import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryBadge } from './CategoryBadge'

describe('CategoryBadge', () => {
  it('default variant is "chip" and renders the label', () => {
    render(<CategoryBadge categoryId="kaggle" />)
    expect(screen.getByText('Kaggle')).toBeInTheDocument()
  })

  it('renders all 4 variants without throwing', () => {
    for (const v of ['dot', 'chip', 'icon-chip', 'full'] as const) {
      const { unmount } = render(<CategoryBadge categoryId="research" variant={v} />)
      expect(screen.getByText('科研')).toBeInTheDocument()
      unmount()
    }
  })

  it('applies data-cat attribute with category id', () => {
    const { container } = render(<CategoryBadge categoryId="tools" variant="chip" />)
    const el = container.querySelector('[data-cat="tools"]')
    expect(el).not.toBeNull()
  })

  it('uses plural "tools" data-cat (spec deviation #3)', () => {
    const { container } = render(<CategoryBadge categoryId="tools" />)
    expect(container.querySelector('[data-cat="tools"]')).not.toBeNull()
    expect(container.querySelector('[data-cat="tool"]')).toBeNull()
  })

  it('full variant shows description text', () => {
    render(<CategoryBadge categoryId="kaggle" variant="full" />)
    expect(screen.getByText(/特征工程/)).toBeInTheDocument()
  })

  it('dot variant has aria-label', () => {
    const { container } = render(<CategoryBadge categoryId="life" variant="dot" />)
    expect(container.querySelector('[aria-label="生活"]')).not.toBeNull()
  })
})
