import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { useMyNotes, useMyDrafts, useDeleteDraft } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CategoryBadge } from '@/components/common/CategoryBadge'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import type { Note } from '@/api/schemas/note'
import type { Draft } from '@/api/endpoints/drafts'

/**
 * /me — 当前用户的已发布笔记 + 草稿。两个 tab，刷新计数。
 */
export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const authed = useAuthStore((s) => s.mode) === 'authed'

  const notesQ = useMyNotes(authed)
  const draftsQ = useMyDrafts(authed)

  const publishedNotes = useMemo<Note[]>(
    () => notesQ.data?.pages.flatMap((p) => p.items) ?? [],
    [notesQ.data],
  )
  const drafts = draftsQ.data ?? []

  if (!authed) {
    return (
      <section data-page="profile" className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-serif text-2xl font-semibold text-text">我的笔记</h1>
        <p className="mt-2 text-sm text-text-muted">
          请先{' '}
          <Link to="/login" className="underline">
            登录
          </Link>{' '}
          后查看自己的笔记。
        </p>
      </section>
    )
  }

  return (
    <section data-page="profile" className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-text">我的笔记</h1>
        <p className="mt-1 text-sm text-text-muted">
          {user?.nickname ?? user?.name ?? user?.sid ?? ''} · 已发布 {publishedNotes.length} · 草稿{' '}
          {drafts.length}
        </p>
      </header>

      <Tabs defaultValue="published">
        <TabsList>
          <TabsTrigger value="published">已发布 ({publishedNotes.length})</TabsTrigger>
          <TabsTrigger value="drafts">草稿 ({drafts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="published" className="mt-6">
          <PublishedList
            notes={publishedNotes}
            isPending={notesQ.isPending}
            isError={notesQ.isError}
            errorMessage={notesQ.error?.message}
            onRetry={() => void notesQ.refetch()}
            hasNextPage={notesQ.hasNextPage ?? false}
            isFetchingNextPage={notesQ.isFetchingNextPage}
            onLoadMore={() => void notesQ.fetchNextPage()}
          />
        </TabsContent>

        <TabsContent value="drafts" className="mt-6">
          <DraftList
            drafts={drafts}
            isPending={draftsQ.isPending}
            isError={draftsQ.isError}
            errorMessage={draftsQ.error?.message}
            onRetry={() => void draftsQ.refetch()}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

type PublishedListProps = {
  notes: Note[]
  isPending: boolean
  isError: boolean
  errorMessage?: string | undefined
  onRetry: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

function PublishedList({
  notes,
  isPending,
  isError,
  errorMessage,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: PublishedListProps) {
  if (isPending) return <LoadingSkeleton preset="card" count={3} />
  if (isError) {
    return <ErrorState title="加载笔记失败" message={errorMessage ?? ''} onRetry={onRetry} />
  }
  if (notes.length === 0) {
    return (
      <EmptyState icon={FileText} title="还没有发布过笔记" description="去写作页发表第一篇笔记吧。">
        <Button asChild variant="outline" size="sm">
          <Link to="/write">开始写作</Link>
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id}>
            <ItemRow
              kind="published"
              to={`/note/${n.id}`}
              title={n.title}
              summary={n.summary}
              categoryId={n.category}
              tags={n.tags}
              timestamp={n.createdAt}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to={`/write/note/${n.id}`}
                    aria-label="编辑笔记"
                    title="编辑"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pencil size={14} className="mr-1" />
                    编辑
                  </Link>
                </Button>
              }
            />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? '加载中…' : '加载更多'}
          </Button>
        </div>
      )}
    </div>
  )
}

type DraftListProps = {
  drafts: Draft[]
  isPending: boolean
  isError: boolean
  errorMessage?: string | undefined
  onRetry: () => void
}

function DraftList({ drafts, isPending, isError, errorMessage, onRetry }: DraftListProps) {
  const del = useDeleteDraft()

  useEffect(() => {
    if (del.isError) {
      toast.error(del.error?.message ?? '删除草稿失败')
    }
  }, [del.isError, del.error])

  if (isPending) return <LoadingSkeleton preset="card" count={3} />
  if (isError) {
    return <ErrorState title="加载草稿失败" message={errorMessage ?? ''} onRetry={onRetry} />
  }
  if (drafts.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="没有保存的草稿"
        description="在写作页保存草稿后会显示在这里。"
      >
        <Button asChild variant="outline" size="sm">
          <Link to="/write">开始写作</Link>
        </Button>
      </EmptyState>
    )
  }

  const onDelete = (id: string, title: string) => {
    if (!window.confirm(`删除草稿「${title || '无标题'}」？此操作不可撤销。`)) return
    del.mutate(id, {
      onSuccess: () => toast.success('草稿已删除'),
    })
  }

  return (
    <ul className="space-y-3">
      {drafts.map((d) => (
        <li key={d.id}>
          <ItemRow
            kind="draft"
            to={`/write/${d.id}`}
            title={d.title || '无标题草稿'}
            summary={summarize(d.content)}
            categoryId={d.category}
            tags={d.tags}
            timestamp={d.updatedAt}
            timestampLabel="更新于"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(d.id, d.title)
                }}
                disabled={del.isPending}
                aria-label="删除草稿"
                title="删除"
                className="text-text-muted hover:text-rose-600"
              >
                <Trash2 size={14} className="mr-1" />
                删除
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  )
}

type ItemRowProps = {
  kind: 'published' | 'draft'
  to: string
  title: string
  summary: string
  categoryId: Note['category'] | null
  tags: string[]
  timestamp: string
  timestampLabel?: string
  action: React.ReactNode
}

function ItemRow({
  kind,
  to,
  title,
  summary,
  categoryId,
  tags,
  timestamp,
  timestampLabel,
  action,
}: ItemRowProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-2 rounded-md border border-border bg-bg p-4 outline-none transition hover:bg-bg-subtle focus-visible:ring-1 focus-visible:ring-border-strong"
    >
      <div className="flex items-center gap-2 text-xs text-text-faint">
        <KindBadge kind={kind} />
        {categoryId && <CategoryBadge categoryId={categoryId} variant="chip" />}
        <span className="ml-auto">
          {timestampLabel ? `${timestampLabel} ` : ''}
          {formatRelative(timestamp)}
        </span>
      </div>
      <h3 className="font-serif text-lg font-semibold text-text">{title}</h3>
      {summary && <p className="line-clamp-2 text-sm text-text-muted">{summary}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map((t) => (
            <span
              key={t}
              className="rounded-sm bg-bg-subtle px-1.5 py-0.5 text-[11px] text-text-muted"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-end" onClick={(e) => e.preventDefault()}>
        {action}
      </div>
    </Link>
  )
}

function KindBadge({ kind }: { kind: 'published' | 'draft' }) {
  if (kind === 'published') {
    return (
      <span className="inline-flex items-center rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        发布
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      草稿
    </span>
  )
}

function summarize(content: string): string {
  const text = content.trim()
  if (!text) return ''
  const firstPara = text.split(/\n\n+/).find((p) => p.trim().length > 0) ?? text
  return firstPara.length > 140 ? firstPara.slice(0, 140) + '…' : firstPara
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const day = 86_400_000
  const hour = 3_600_000
  const min = 60_000
  if (diffMs < min) return '刚刚'
  if (diffMs < hour) return `${Math.floor(diffMs / min)} 分钟前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}
