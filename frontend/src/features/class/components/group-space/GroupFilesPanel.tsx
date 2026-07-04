import { useRef, useState } from 'react'
import { Download, FileUp, Trash2 } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import { groupFileDownloadUrl } from '@/api/endpoints/groups'
import type { GroupDetail, GroupFile } from '@/api/schemas/class'
import { FilePreviewDialog } from '@/components/common/FilePreviewDialog'
import { FileTypeIcon } from '@/components/common/FileTypeIcon'
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
import { cn } from '@/lib/cn'

import { useDeleteGroupFile, useGroupFiles } from '../../hooks/useGroupFiles'
import { GroupUploadDialog } from './GroupUploadDialog'

type Props = {
  gid: string
  group: GroupDetail
  currentSid: string
  canManage: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

/**
 * 组内文件面板 —— `[data-group-files-pane]` 原生 HTML5 拖拽落区
 * （materials 左栏同款：dragenter 计数防抖 + 「松开以上传」全遮罩，drop
 * 打开预填的上传弹窗）。行内：预览（FilePreviewDialog）/ 下载 / 删除。
 */
export function GroupFilesPanel({ gid, currentSid, canManage }: Props) {
  const { data: files, isLoading } = useGroupFiles(gid, true)
  const deleteFile = useDeleteGroupFile(gid)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [initialFiles, setInitialFiles] = useState<File[] | null>(null)
  const [preview, setPreview] = useState<GroupFile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<GroupFile | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)

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

      <div className="mb-3 flex items-center gap-2">
        <h2 className="m-0 text-sm font-semibold text-text">文件</h2>
        <span className="text-xs text-text-faint">{files?.length ?? 0} 个</span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => {
            setInitialFiles(null)
            setUploadOpen(true)
          }}
        >
          <FileUp size={14} aria-hidden className="mr-1.5" />
          上传文件
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton preset="paragraph" count={1} />
      ) : !files || files.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-text-faint">
          还没有文件 —— 点「上传文件」或直接把文件拖进来。
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {files.map((f) => (
            <li
              key={f.id}
              className={cn(
                'group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-bg-subtle',
              )}
            >
              <FileTypeIcon ext={f.ext ?? ''} size={18} className="size-[18px] shrink-0" />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm text-text hover:underline"
                onClick={() => setPreview(f)}
              >
                {f.name}
              </button>
              <span className="shrink-0 text-xs tabular-nums text-text-faint">{f.size}</span>
              <span className="hidden shrink-0 text-xs text-text-faint sm:inline">
                {f.uploadedByNickname} · {formatDate(f.createdAt)}
              </span>
              <a
                href={groupFileDownloadUrl(gid, f.id)}
                className="shrink-0 rounded p-1 text-text-muted opacity-0 transition hover:text-text group-hover:opacity-100"
                aria-label={`下载 ${f.name}`}
              >
                <Download size={14} aria-hidden />
              </a>
              {canDelete(f) && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(f)}
                  className="shrink-0 rounded p-1 text-text-muted opacity-0 transition hover:text-cat-research group-hover:opacity-100"
                  aria-label={`删除 ${f.name}`}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
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
