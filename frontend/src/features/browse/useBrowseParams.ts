import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CATEGORIES, type CategoryId } from '@/lib/categories'

export type BrowseSort = 'latest' | 'hot' | 'liked'

const VALID_CATS = new Set<CategoryId>(CATEGORIES.map((c) => c.id))
const VALID_SORTS = new Set<BrowseSort>(['latest', 'hot', 'liked'])

export type BrowseParams = {
  cat: CategoryId | undefined
  sort: BrowseSort | undefined
  q: string
  tags: string[]
  setCat: (cat: CategoryId | null) => void
  setSort: (sort: BrowseSort | null) => void
  setQ: (q: string) => void
  toggleTag: (tag: string) => void
  clearAll: () => void
}

export function useBrowseParams(): BrowseParams {
  const [params, setParams] = useSearchParams()

  const catRaw = params.get('cat')
  const sortRaw = params.get('sort')
  const q = params.get('q') ?? ''
  const tagsRaw = params.get('tags') ?? ''

  const cat: CategoryId | undefined =
    catRaw && VALID_CATS.has(catRaw as CategoryId)
      ? (catRaw as CategoryId)
      : undefined
  const sort: BrowseSort | undefined =
    sortRaw && VALID_SORTS.has(sortRaw as BrowseSort)
      ? (sortRaw as BrowseSort)
      : undefined
  const tags = useMemo(
    () => tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
    [tagsRaw],
  )

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setCat = useCallback(
    (next: CategoryId | null) =>
      update((p) => {
        if (next) p.set('cat', next)
        else p.delete('cat')
      }),
    [update],
  )

  const setSort = useCallback(
    (next: BrowseSort | null) =>
      update((p) => {
        if (next) p.set('sort', next)
        else p.delete('sort')
      }),
    [update],
  )

  const setQ = useCallback(
    (next: string) =>
      update((p) => {
        const trimmed = next.trim()
        if (trimmed) p.set('q', trimmed)
        else p.delete('q')
      }),
    [update],
  )

  const toggleTag = useCallback(
    (tag: string) =>
      update((p) => {
        const current = (p.get('tags') ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
        const idx = current.indexOf(tag)
        const next = idx >= 0
          ? current.filter((_, i) => i !== idx)
          : [...current, tag]
        if (next.length > 0) p.set('tags', next.join(','))
        else p.delete('tags')
      }),
    [update],
  )

  const clearAll = useCallback(
    () =>
      update((p) => {
        p.delete('cat')
        p.delete('sort')
        p.delete('q')
        p.delete('tags')
      }),
    [update],
  )

  return { cat, sort, q, tags, setCat, setSort, setQ, toggleTag, clearAll }
}
