import { useEffect, useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useBrowseParams } from './useBrowseParams'

export function SearchBar() {
  const { q, setQ } = useBrowseParams()
  const [draft, setDraft] = useState(q)

  // URL → input sync (e.g., user clicked a recommended search link)
  useEffect(() => {
    setDraft(q)
  }, [q])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setQ(draft)
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="relative w-full"
    >
      <label htmlFor="browse-search" className="sr-only">
        搜索笔记
      </label>
      <Search
        size={14}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <Input
        id="browse-search"
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="搜索笔记 / 摘要 / 标签"
        className="h-10 pl-9 pr-9 text-sm"
      />
      {draft && (
        <button
          type="button"
          aria-label="清空搜索"
          onClick={() => {
            setDraft('')
            setQ('')
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-text-muted transition hover:bg-bg-subtle hover:text-text"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </form>
  )
}
