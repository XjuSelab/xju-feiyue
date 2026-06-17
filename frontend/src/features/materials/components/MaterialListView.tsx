import * as React from 'react'
import { Plus, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { FilePreviewDialog } from '@/components/common/FilePreviewDialog'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/cn'

import { EMPTY_RESOURCES, EMPTY_SEARCH, ERROR_COPY, TAG_OPTIONS } from '../data'
import type { MaterialFile, MaterialResource, PreviewTarget, ResourceTag } from '../types'

/** 课程类型筛选选项卡：全部 + 三类。 */
const TAG_TABS: ReadonlyArray<{ value: ResourceTag | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  ...TAG_OPTIONS,
]
import { useDeleteResource, useResources } from '../hooks/useMaterials'
import { MaterialCard } from './MaterialCard'
import { MaterialNotice } from './MaterialNotice'
import { RecentUploads, type RecentItem } from './RecentUploads'
import { ResourceFormDialog } from './ResourceFormDialog'
import { useConfirm } from './ConfirmDialog'

/**
 * 资料列表场景 —— 标题「资料」+ 计数 + 页面级搜索 + 卡片网格 + 最近上传条带 +
 * 右下 FAB（新建资源）+ 空态。
 *
 * 设计：
 * - 搜索走 300ms debounce → useResources(q)（共享知识库，全部未删资源）。
 * - 删除走 useConfirm（destructive）+ useDeleteResource（toast 在 hook 层）。
 * - 编辑/新建走同一 ResourceFormDialog。
 * - 文件预览复用共享 FilePreviewDialog（与写作栏附件同一套 viewer）。
 * - 进详情由父级传入 `onOpenResource`（路由/详情阶段接线），本组件不直接导航。
 * - isError 渲染 ErrorState；isPending 渲染骨架，绝不白屏。
 */

type Props = {
  /** 点击卡片进详情时回调（详情/路由阶段接线）。 */
  onOpenResource?: (resource: MaterialResource) => void
}

const RECENT_LIMIT = 12

export function MaterialListView({ onOpenResource }: Props) {
  const mode = useAuthStore((s) => s.mode)
  const isAuthed = mode === 'authed'

  const [rawQuery, setRawQuery] = React.useState('')
  const [query, setQuery] = React.useState('')

  // 300ms debounce：输入停 300ms 后才打 query。
  React.useEffect(() => {
    const id = window.setTimeout(() => setQuery(rawQuery.trim()), 300)
    return () => window.clearTimeout(id)
  }, [rawQuery])

  const resourcesQuery = useResources(query || undefined)
  const del = useDeleteResource()
  const { confirm, host: confirmHost } = useConfirm()

  // 新建 / 编辑对话框状态。
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MaterialResource | null>(null)

  // 文件预览（最近上传点击）。
  const [preview, setPreview] = React.useState<PreviewTarget | null>(null)

  // 课程类型筛选选项卡。
  const [tab, setTab] = React.useState<ResourceTag | 'all'>('all')

  const resources = React.useMemo(() => resourcesQuery.data ?? [], [resourcesQuery.data])
  // 按选项卡过滤（客户端：列表已返回全部资源）。
  const filtered = React.useMemo(
    () => (tab === 'all' ? resources : resources.filter((r) => r.tag === tab)),
    [resources, tab],
  )
  const isFiltered = query !== '' || tab !== 'all'

  const onCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const onEdit = (resource: MaterialResource) => {
    setEditing(resource)
    setFormOpen(true)
  }

  const onDelete = async (resource: MaterialResource) => {
    const ok = await confirm({
      title: `删除「${resource.title}」？`,
      description: '此操作不可撤销，该资料下的所有文件将一并删除。',
      tone: 'destructive',
      confirmText: '删除',
    })
    if (ok) del.mutate(resource.id)
  }

  // 最近上传：从已带树的资源里聚合文件（列表场景多数树为空，命中详情缓存时才有）。
  const recentItems = React.useMemo<RecentItem[]>(() => {
    const items: RecentItem[] = []
    for (const r of resources) {
      collectFiles(r.files, (f) => {
        if (!f.url) return
        items.push({
          fileId: f.id,
          url: f.url,
          name: f.name,
          ext: f.ext,
          resourceTitle: r.title,
        })
      })
    }
    return items.slice(0, RECENT_LIMIT)
  }, [resources])

  return (
    <main className="w-full px-7 pb-24 pt-7 xl:px-10">
      {confirmHost}

      {/* 顶部行：标题+计数（左） / 搜索框 + 最近上传弹出按钮（右，ml-auto）同行并列。
          窄屏 flex-wrap 优雅换行。 */}
      <header className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-baseline gap-3">
          <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.01em] text-text">
            资料
          </h1>
          <span className="font-sans text-[13px] text-text-muted">
            共 <strong className="font-semibold text-text">{resources.length}</strong> 份课程资料
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* 页面级搜索 */}
          <div className="relative w-52 sm:w-64">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint"
            />
            <Input
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="搜索资料…"
              className="pl-9"
              aria-label="搜索资料"
            />
          </div>

          {/* 最近上传（弹出层按钮，仅有最近文件时出现） */}
          <RecentUploads items={recentItems} onPreview={setPreview} />
        </div>
      </header>

      {/* 致谢信息条（Notion 风格长条；管理员可编辑/隐藏） */}
      <MaterialNotice />

      {/* 课程类型筛选选项卡 */}
      <div role="tablist" aria-label="课程类型" className="mb-5 flex flex-wrap items-center gap-1">
        {TAG_TABS.map((t) => {
          const active = tab === t.value
          const count =
            t.value === 'all'
              ? resources.length
              : resources.filter((r) => r.tag === t.value).length
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.value)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition',
                active
                  ? 'bg-bg-subtle text-text'
                  : 'text-text-muted hover:bg-bg-subtle hover:text-text',
              )}
            >
              {t.label}
              <span className="text-xs text-text-faint">{count}</span>
            </button>
          )
        })}
      </div>

      <ListBody
        isFiltered={isFiltered}
        isPending={resourcesQuery.isPending}
        isError={resourcesQuery.isError}
        errorMessage={resourcesQuery.error?.message}
        resources={filtered}
        onRetry={() => void resourcesQuery.refetch()}
        onOpen={(r) => onOpenResource?.(r)}
        onEdit={onEdit}
        onDelete={onDelete}
        onCreate={onCreate}
        canCreate={isAuthed}
      />

      {/* 右下 FAB：新建资料（仅登录用户）。 */}
      {isAuthed ? (
        <Button
          onClick={onCreate}
          size="icon"
          className="fixed bottom-8 right-8 z-30 size-12 rounded-full shadow-lg"
          aria-label="新建资料"
          title="新建资料"
        >
          <Plus className="size-5" />
        </Button>
      ) : null}

      <ResourceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        resource={editing}
        onCreated={(r) => onOpenResource?.(r)}
      />

      <FilePreviewDialog
        open={preview != null}
        onOpenChange={(o) => {
          if (!o) setPreview(null)
        }}
        url={preview?.url ?? ''}
        name={preview?.name ?? ''}
        fileId={preview?.fileId}
      />
    </main>
  )
}

function ListBody({
  isFiltered,
  isPending,
  isError,
  errorMessage,
  resources,
  onRetry,
  onOpen,
  onEdit,
  onDelete,
  onCreate,
  canCreate,
}: {
  isFiltered: boolean
  isPending: boolean
  isError: boolean
  errorMessage?: string | undefined
  resources: MaterialResource[]
  onRetry: () => void
  onOpen: (r: MaterialResource) => void
  onEdit: (r: MaterialResource) => void
  onDelete: (r: MaterialResource) => void
  onCreate: () => void
  canCreate: boolean
}) {
  if (isPending) return <LoadingSkeleton preset="card" count={6} />

  if (isError) {
    return <ErrorState title={ERROR_COPY.list} message={errorMessage ?? ''} onRetry={onRetry} />
  }

  if (resources.length === 0) {
    const copy = isFiltered ? EMPTY_SEARCH : EMPTY_RESOURCES
    return (
      <EmptyState
        icon={copy.icon}
        title={copy.title}
        description={copy.description}
        {...(!isFiltered && canCreate ? { action: { label: '新建资料', onClick: onCreate } } : {})}
      />
    )
  }

  return (
    <div
      className={cn('grid gap-4', 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}
    >
      {resources.map((r) => (
        <MaterialCard
          key={r.id}
          resource={r}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

/** 递归遍历树，对每个文件调用 cb。 */
function collectFiles(nodes: MaterialFile[], cb: (f: MaterialFile) => void): void {
  for (const node of nodes) {
    if (node.isFolder) collectFiles(node.children ?? [], cb)
    else cb(node)
  }
}
