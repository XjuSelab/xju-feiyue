import { useMemo, useRef, useState } from 'react'
import { FileUp, LayoutGrid, List, Search } from 'lucide-react'
import { toast } from 'sonner'

import { resolveAssetUrl } from '@/api/client'
import { downloadGroupFile, groupFileDownloadUrl } from '@/api/endpoints/groups'
import type { GroupDetail, GroupFile } from '@/api/schemas/class'
import { FilePreviewDialog } from '@/components/common/FilePreviewDialog'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/cn'

import { useDeleteGroupFile, useGroupFiles } from '../../hooks/useGroupFiles'
import {
  extFacets,
  filterFiles,
  groupByExt,
  groupByUploader,
  SORT_LABELS,
  sortFiles,
  uploaderFacets,
  type SortKey,
} from '../../lib/groupFiles'
import { FileAccordion } from './FileAccordion'
import { FileRow } from './FileRow'
import { GroupUploadDialog } from './GroupUploadDialog'

type Props = {
  gid: string
  group: GroupDetail
  currentSid: string
  canManage: boolean
}

type ViewMode = 'list' | 'card'
const SORT_KEYS: SortKey[] = ['newest', 'oldest', 'name', 'size']

/**
 * 组内文件面板 —— `[data-group-files-pane]` 原生 HTML5 拖拽落区（materials
 * 左栏同款）。两种展示：列表（搜索 + 格式/上传者筛选 + 排序）与卡片（按
 * 格式、按上传者两个横向展开手风琴）。行内：预览 / 下载 / 删除。
 */
export function GroupFilesPanel({ gid, currentSid, canManage }: Props) {
  const { data: files, isLoading } = useGroupFiles(gid, true)
  const deleteFile = useDeleteGroupFile(gid)

  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [extFilter, setExtFilter] = useState('all')
  const [uploaderFilter, setUploaderFilter] = useState('all')
  const [sort, setSort] = useState<SortKey>('newest')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [initialFiles, setInitialFiles] = useState<File[] | null>(null)
  const [preview, setPreview] = useState<GroupFile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<GroupFile | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)

  const all = useMemo(() => files ?? [], [files])
  const exts = useMemo(() => extFacets(all), [all])
  const uploaders = useMemo(() => uploaderFacets(all), [all])
  const listFiles = useMemo(
    () => sortFiles(filterFiles(all, { search, ext: extFilter, uploader: uploaderFilter }), sort),
    [all, search, extFilter, uploaderFilter, sort],
  )
  const byExt = useMemo(() => groupByExt(all), [all])
  const byUploader = useMemo(() => groupByUploader(all), [all])

  const onDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    dragDepth.current += 1
    setDragActive(true)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault()
  }
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragActive(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length === 0) return
    setInitialFiles(dropped)
    setUploadOpen(true)
  }

  const canDelete = (f: GroupFile) => canManage || f.uploadedBySid === currentSid
  const onDownload = (f: GroupFile) => {
    void downloadGroupFile(gid, f).catch((err) =>
      toast.error(err instanceof Error ? err.message : '下载失败'),
    )
  }
  const rowProps = (f: GroupFile) => ({
    file: f,
    onPreview: setPreview,
    onDownload,
    onDelete: canDelete(f) ? setConfirmDelete : undefined,
  })

  const hasFiles = all.length > 0

  return (
    <section
      aria-label="小组文件"
      data-group-files-pane
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative rounded-lg border border-border bg-bg p-4"
    >
      {dragActive && (
        <div className="absolute inset-0 z-10 grid place-content-center rounded-lg border-2 border-dashed border-cat-kaggle bg-tag-kaggle/50">
          <p className="m-0 text-sm font-medium text-text">松开以上传到本小组</p>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="m-0 text-sm font-semibold text-text">文件</h2>
        <span className="text-xs text-text-faint">{all.length} 个</span>

        {hasFiles && (
          <div className="ml-auto inline-flex rounded-md border border-border p-0.5">
            <ViewButton active={view === 'list'} onClick={() => setView('list')} label="列表">
              <List size={15} aria-hidden />
            </ViewButton>
            <ViewButton active={view === 'card'} onClick={() => setView('card')} label="卡片">
              <LayoutGrid size={15} aria-hidden />
            </ViewButton>
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className={cn(!hasFiles && 'ml-auto')}
          onClick={() => {
            setInitialFiles(null)
            setUploadOpen(true)
          }}
        >
          <FileUp size={14} aria-hidden className="mr-1.5" />
          上传文件
        </Button>
      </div>

      {/* 列表模式工具条：搜索 + 格式 + 上传者 + 排序 */}
      {hasFiles && view === 'list' && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[8rem] flex-1">
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文件名"
              className="h-8 pl-8"
              aria-label="搜索文件名"
            />
          </div>

          <Select value={extFilter} onValueChange={setExtFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[6rem]" aria-label="按格式筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部格式</SelectItem>
              {exts.map((e) => (
                <SelectItem key={e.key || '__none__'} value={e.key}>
                  {e.label}（{e.count}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={uploaderFilter} onValueChange={setUploaderFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[6rem]" aria-label="按上传者筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部上传者</SelectItem>
              {uploaders.map((u) => (
                <SelectItem key={u.key} value={u.key}>
                  {u.label}（{u.count}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-auto min-w-[6rem]" aria-label="排序">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton preset="paragraph" count={1} />
      ) : !hasFiles ? (
        <p className="m-0 py-6 text-center text-sm text-text-faint">
          还没有文件 —— 点「上传文件」或直接把文件拖进来。
        </p>
      ) : view === 'list' ? (
        listFiles.length === 0 ? (
          <p className="m-0 py-6 text-center text-sm text-text-faint">没有匹配的文件。</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {listFiles.map((f) => (
              <FileRow key={f.id} {...rowProps(f)} />
            ))}
          </ul>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <FileAccordion
            title="按格式"
            groups={byExt}
            renderRow={(f) => <FileRow key={f.id} {...rowProps(f)} />}
          />
          <FileAccordion
            title="按上传者"
            groups={byUploader}
            renderRow={(f) => <FileRow key={f.id} {...rowProps(f)} hideUploader />}
          />
        </div>
      )}

      <GroupUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        gid={gid}
        initialFiles={initialFiles}
      />

      {preview && (
        <FilePreviewDialog
          open={preview != null}
          onOpenChange={(o) => !o && setPreview(null)}
          url={preview.url ? resolveAssetUrl(preview.url) : groupFileDownloadUrl(gid, preview.id)}
          name={preview.name}
        />
      )}

      <AlertDialog open={confirmDelete != null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{confirmDelete?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>文件将从小组空间移除，无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteFile.mutate(confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${label}视图`}
      aria-label={`${label}视图`}
      className={cn(
        'inline-grid size-7 place-content-center rounded transition',
        active ? 'bg-bg-subtle text-text' : 'text-text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  )
}
