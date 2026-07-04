import * as React from 'react'
import { AlertCircle, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react'

import type { UploadProgress } from '@/api/upload'
import { FileTypeIcon } from '@/components/common/FileTypeIcon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { extOf, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/fileTypes'

import { useUploadGroupFiles } from '../../hooks/useGroupFiles'

/**
 * 组内上传弹窗 —— materials UploadDialog 的裁剪版：去掉目标文件夹
 * Select（组内文件是扁平列表），其余 UX 原样保留 —— 拖拽/点选多文件、
 * 可编辑主名（扩展名只读后缀）、50MB 前端拦截、XHR 逐字节进度 +
 * processing 不确定态、成功自动关闭。
 */

type Status = 'idle' | 'uploading' | 'success' | 'error'

type PendingFile = {
  uid: string
  file: File
  baseName: string
  ext: string
  tooBig: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  gid: string
  /** 面板拖拽落入时预填；点选路径为空。 */
  initialFiles?: File[] | null
}

let uidSeq = 0
function nextUid(): string {
  uidSeq += 1
  return `gpf_${uidSeq}_${Date.now()}`
}

function toPending(files: File[]): PendingFile[] {
  return files.map((file) => {
    const ext = extOf(file.name)
    const base = ext ? file.name.slice(0, file.name.length - ext.length) : file.name
    return { uid: nextUid(), file, baseName: base, ext, tooBig: file.size > MAX_UPLOAD_BYTES }
  })
}

export function GroupUploadDialog({ open, onOpenChange, gid, initialFiles }: Props) {
  const upload = useUploadGroupFiles(gid)

  const [pending, setPending] = React.useState<PendingFile[]>([])
  const [status, setStatus] = React.useState<Status>('idle')
  const [errorMsg, setErrorMsg] = React.useState('')
  const [progress, setProgress] = React.useState<UploadProgress | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dragDepth = React.useRef(0)

  React.useEffect(() => {
    if (!open) return
    setPending(initialFiles && initialFiles.length > 0 ? toPending(initialFiles) : [])
    setStatus('idle')
    setErrorMsg('')
    setProgress(null)
    setDragActive(false)
    dragDepth.current = 0
  }, [open, initialFiles])

  const addFiles = React.useCallback((files: FileList | File[] | null) => {
    if (!files) return
    const arr = Array.from(files)
    if (arr.length === 0) return
    setPending((prev) => [...prev, ...toPending(arr)])
    setStatus('idle')
    setErrorMsg('')
  }, [])

  const removeOne = (uid: string) => setPending((prev) => prev.filter((p) => p.uid !== uid))
  const renameOne = (uid: string, baseName: string) =>
    setPending((prev) => prev.map((p) => (p.uid === uid ? { ...p, baseName } : p)))

  const totalBytes = React.useMemo(
    () => pending.reduce((sum, p) => sum + p.file.size, 0),
    [pending],
  )
  const hasTooBig = pending.some((p) => p.tooBig)
  const canSubmit = pending.length > 0 && !hasTooBig && status !== 'uploading'

  const onSubmit = () => {
    if (!canSubmit) return
    const files = pending.map((p) => {
      const finalName = `${p.baseName.trim() || p.file.name.replace(p.ext, '')}${p.ext}`
      if (finalName === p.file.name) return p.file
      return new File([p.file], finalName, { type: p.file.type, lastModified: p.file.lastModified })
    })
    setStatus('uploading')
    setErrorMsg('')
    setProgress({ loaded: 0, total: 0, ratio: 0, phase: 'uploading' })
    upload.mutate(
      { files, onProgress: (p) => setProgress(p) },
      {
        onSuccess: () => {
          setStatus('success')
          window.setTimeout(() => onOpenChange(false), 600)
        },
        onError: (e) => {
          setStatus('error')
          setErrorMsg(e instanceof Error ? e.message : '上传失败')
        },
      },
    )
  }

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
    addFiles(e.dataTransfer.files)
  }

  const uploading = status === 'uploading'

  return (
    <Dialog open={open} onOpenChange={(o) => (!uploading ? onOpenChange(o) : undefined)}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-text">上传到小组</DialogTitle>
          <DialogDescription className="text-text-muted">
            支持拖拽或点选多个文件，单个文件最大 {formatBytes(MAX_UPLOAD_BYTES)}。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              dragActive
                ? 'border-cat-kaggle bg-tag-kaggle/40'
                : 'border-border-strong bg-bg-subtle hover:bg-bg-hover',
            )}
            aria-label="选择或拖入文件"
          >
            <UploadCloud
              aria-hidden
              size={28}
              strokeWidth={1.5}
              className={dragActive ? 'text-cat-kaggle' : 'text-text-muted'}
            />
            <span className="text-sm font-medium text-text">点击选择文件，或拖拽到此处</span>
            <span className="text-xs text-text-muted">可一次选择多个文件</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />

          {pending.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>
                  待上传 <strong className="font-semibold text-text">{pending.length}</strong> 个文件
                </span>
                <span className={cn('tabular-nums', hasTooBig && 'text-cat-research')}>
                  共 {formatBytes(totalBytes)}
                </span>
              </div>
              <ul className="space-y-1.5">
                {pending.map((p) => (
                  <li
                    key={p.uid}
                    className={cn(
                      'flex items-center gap-2 rounded-md border bg-bg-subtle px-2.5 py-1.5',
                      p.tooBig ? 'border-cat-research/40' : 'border-border',
                    )}
                  >
                    <FileTypeIcon ext={p.ext} size={18} className="size-[18px] shrink-0" />
                    <div className="flex min-w-0 flex-1 items-center">
                      <Input
                        value={p.baseName}
                        onChange={(e) => renameOne(p.uid, e.target.value)}
                        disabled={uploading}
                        aria-label={`重命名 ${p.file.name}`}
                        className="h-7 min-w-0 flex-1 rounded-r-none border-r-0 text-xs"
                      />
                      <span className="shrink-0 rounded-r-md border border-l-0 border-input bg-bg px-1.5 py-1 text-xs text-text-faint">
                        {p.ext || '—'}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-xs tabular-nums',
                        p.tooBig ? 'font-medium text-cat-research' : 'text-text-faint',
                      )}
                      title={p.tooBig ? `超过 ${formatBytes(MAX_UPLOAD_BYTES)} 上限` : undefined}
                    >
                      {formatBytes(p.file.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeOne(p.uid)}
                      disabled={uploading}
                      aria-label={`移除 ${p.file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              {hasTooBig ? (
                <p className="flex items-center gap-1.5 text-xs text-cat-research">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                  存在超过 {formatBytes(MAX_UPLOAD_BYTES)} 的文件，请移除后再上传。
                </p>
              ) : null}
            </div>
          ) : null}

          {uploading ? (
            <div className="space-y-1.5" aria-live="polite">
              <Progress
                value={
                  progress?.phase === 'processing' || progress?.ratio == null
                    ? 66
                    : Math.round(progress.ratio * 100)
                }
                className={
                  progress?.phase === 'processing' || progress?.ratio == null
                    ? 'animate-pulse'
                    : undefined
                }
              />
              {progress?.phase === 'processing' ? (
                <p className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                  服务器接收中…
                </p>
              ) : (
                <p className="flex items-center justify-between gap-1.5 text-xs text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                    正在上传 {pending.length} 个文件…
                  </span>
                  {progress?.ratio != null ? (
                    <span className="tabular-nums">{Math.round(progress.ratio * 100)}%</span>
                  ) : null}
                </p>
              )}
            </div>
          ) : null}
          {status === 'success' ? (
            <p className="flex items-center gap-1.5 text-xs text-cat-tools" aria-live="polite">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
              上传成功
            </p>
          ) : null}
          {status === 'error' ? (
            <p className="flex items-center gap-1.5 text-xs text-cat-research" role="alert">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden />
              {errorMsg || '上传失败，请重试'}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            取消
          </Button>
          <Button type="button" onClick={onSubmit} disabled={!canSubmit}>
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'error' ? '重试上传' : `上传${pending.length > 0 ? ` (${pending.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
