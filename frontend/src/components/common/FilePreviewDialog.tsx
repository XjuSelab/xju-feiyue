import * as React from 'react'
import { Download, ExternalLink, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileTypeIcon } from '@/components/common/FileTypeIcon'
import { extOf, previewKind, type PreviewKind } from '@/lib/fileTypes'
import { resolveAssetUrl } from '@/api/client'
import { cn } from '@/lib/cn'

/**
 * FilePreviewDialog —— 统一文件预览弹窗（写作栏附件 FileCard 点「预览」时打开）。
 *
 * 设计（角色清单 + plan-file-upload.md「关键修订」）：
 * - shadcn `ui/dialog` 包一层（max-w-4xl max-h-[85vh]），DialogTitle 必填（a11y）。
 * - Header 放文件名 + 下载 / 新窗口按钮。
 * - 按 `previewKind(ext)` 把 viewer 路由到 `components/common/preview/*`（全部 React.lazy
 *   + Suspense fallback=Loader2，首屏零增）；`unsupported` → 降级下载卡。
 * - 任一 viewer 抛错 → 内置 ErrorBoundary catch → 降级下载卡 + sonner 由消费侧自理，绝不白屏。
 * - 下载用 `fetch(url)→blob→a[download]`：跨源（dev 5173↔8000）也能真正触发下载而非导航。
 *
 * 复用：资料页 PreviewPane 直接消费下方 viewer（不走本 Dialog），本 Dialog 仅服务附件场景。
 */

const PdfViewer = React.lazy(() => import('@/components/common/preview/PdfViewer'))
const DocxViewer = React.lazy(() => import('@/components/common/preview/DocxViewer'))
const ExcelViewer = React.lazy(() => import('@/components/common/preview/ExcelViewer'))
const ImageViewer = React.lazy(() => import('@/components/common/preview/ImageViewer'))
const CodeViewer = React.lazy(() => import('@/components/common/preview/CodeViewer'))

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  name: string
  fileId?: string | undefined
}

export function FilePreviewDialog({ open, onOpenChange, url, name, fileId }: Props) {
  const ext = extOf(name) || extOf(url)
  const kind = previewKind(ext)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[92vw] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-border-strong px-4 py-3 pr-12 text-left">
          <FileTypeIcon ext={ext} className="size-6 shrink-0" />
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium" title={name}>
            {name}
          </DialogTitle>
          <div className="flex shrink-0 items-center gap-1">
            <DownloadButton url={url} name={name} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="在新窗口打开"
              title="在新窗口打开"
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* 预览主体：只在 open 时挂载 viewer（关闭即卸载、释放资源 + 重置 ErrorBoundary）。 */}
        <div className="min-h-0 flex-1">
          {open && (
            <PreviewBody
              kind={kind}
              url={url}
              name={name}
              fileId={fileId}
              onDownloadUrl={url}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 路由到对应 viewer（lazy + Suspense + ErrorBoundary 兜底）。 */
function PreviewBody({
  kind,
  url,
  name,
  fileId,
  onDownloadUrl,
}: {
  kind: PreviewKind
  url: string
  name: string
  fileId?: string | undefined
  onDownloadUrl: string
}) {
  if (kind === 'unsupported') {
    return <UnsupportedCard url={onDownloadUrl} name={name} />
  }

  const viewer = (() => {
    switch (kind) {
      case 'pdf':
        return <PdfViewer url={url} name={name} fileId={fileId} />
      case 'docx':
        return <DocxViewer url={url} name={name} fileId={fileId} />
      case 'xlsx':
        return <ExcelViewer url={url} name={name} fileId={fileId} />
      case 'image':
        return <ImageViewer url={url} name={name} fileId={fileId} />
      case 'code':
        return <CodeViewer url={url} name={name} fileId={fileId} />
      default:
        return null
    }
  })()

  return (
    // key={url}：换文件时整棵重挂，重置 ErrorBoundary 的错误态。
    <PreviewErrorBoundary key={url} fallback={<UnsupportedCard url={onDownloadUrl} name={name} failed />}>
      <React.Suspense fallback={<CenteredSpinner />}>{viewer}</React.Suspense>
    </PreviewErrorBoundary>
  )
}

function CenteredSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
    </div>
  )
}

/** 不支持在线预览 / 预览失败：降级下载卡（绝不白屏）。 */
function UnsupportedCard({
  url,
  name,
  failed = false,
}: {
  url: string
  name: string
  failed?: boolean
}) {
  const ext = extOf(name) || extOf(url)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-transparent p-8 text-center">
      <FileTypeIcon ext={ext} className="size-16" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-text">{name}</p>
        <p className="text-xs text-text-muted">
          {failed ? '预览加载失败，请下载后在本地打开。' : '该文件类型暂不支持在线预览。'}
        </p>
      </div>
      <DownloadButton url={url} name={name} variant="outline" withLabel />
    </div>
  )
}

/**
 * 下载按钮：fetch→blob→a[download]，跨源也能真正触发下载。
 * 失败回退到直接打开 url（同源 / blob 一定成立；跨源退化为新窗口）。
 */
function DownloadButton({
  url,
  name,
  variant = 'ghost',
  withLabel = false,
}: {
  url: string
  name: string
  variant?: React.ComponentProps<typeof Button>['variant']
  withLabel?: boolean
}) {
  const [busy, setBusy] = React.useState(false)

  const onDownload = async () => {
    setBusy(true)
    try {
      const res = await fetch(resolveAssetUrl(url))
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = name || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      // 兜底：直接打开（同源/blob 触发下载，跨源至少不静默失败）。
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={withLabel ? 'sm' : 'icon'}
      className={cn(!withLabel && 'h-8 w-8')}
      aria-label="下载"
      title="下载"
      disabled={busy}
      onClick={onDownload}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {withLabel && <span>下载文件</span>}
    </Button>
  )
}

/** 捕获 viewer 渲染期异常 → 渲染 fallback 降级卡，绝不白屏。 */
class PreviewErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown) {
    // 仅记录；用户可见兜底由 fallback 承担（不在渲染期调 toast，MEMORY 警示）。
    console.error('[FilePreviewDialog] viewer 渲染失败:', error)
  }

  override render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
