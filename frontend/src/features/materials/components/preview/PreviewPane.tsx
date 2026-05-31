import * as React from 'react'
import { Download, FileQuestion, Loader2, MousePointerClick } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FileTypeIcon } from '@/components/common/FileTypeIcon'
import { extOf, previewKind, type PreviewKind } from '@/lib/fileTypes'
import { cn } from '@/lib/cn'

import { useDownload } from '../../hooks/useDownload'
import type { PreviewTarget } from '../../types'

/**
 * PreviewPane —— 资料详情 split-pane 右栏：信息栏（文件名 + 下载）+ 按 previewKind
 * 直接挂载共享 viewer（不走 FilePreviewDialog，复用 components/common/preview/*）。
 *
 * 设计（角色清单 + plan-materials-integration.md「预览」）：
 * - viewer 全部 `React.lazy`（与 FilePreviewDialog 同一组导入），首屏零增；按 kind
 *   分发，`unsupported` → 降级下载卡。
 * - `key={file.fileId}`：换文件整棵重挂，重置 viewer 内竞态/缩放与 ErrorBoundary 错误态。
 * - 任一 viewer 抛错 → 内置 PreviewErrorBoundary catch → 降级下载卡，绝不白屏
 *   （toast 不在渲染期调用，MEMORY 警示；下载/预览失败兜底在交互回调里）。
 * - 未选中文件 → 引导空态（提示左侧点选）。
 */

const PdfViewer = React.lazy(() => import('@/components/common/preview/PdfViewer'))
const DocxViewer = React.lazy(() => import('@/components/common/preview/DocxViewer'))
const ExcelViewer = React.lazy(() => import('@/components/common/preview/ExcelViewer'))
const ImageViewer = React.lazy(() => import('@/components/common/preview/ImageViewer'))
const CodeViewer = React.lazy(() => import('@/components/common/preview/CodeViewer'))

type Props = {
  /** 当前预览的文件；null = 未选中（引导空态）。 */
  file: PreviewTarget | null
  className?: string
}

export function PreviewPane({ file, className }: Props) {
  return (
    <section className={cn('flex h-full min-h-0 flex-col bg-bg', className)} aria-label="文件预览">
      {file ? <PreviewBody file={file} /> : <EmptyHint />}
    </section>
  )
}

function PreviewBody({ file }: { file: PreviewTarget }) {
  const ext = extOf(file.name) || extOf(file.url)
  const kind = previewKind(ext)

  return (
    <>
      {/* 信息栏：文件名 + 下载 */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border-strong bg-bg-subtle px-4 py-2.5">
        <FileTypeIcon ext={ext} className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text" title={file.name}>
          {file.name}
        </span>
        <DownloadButton fileId={file.fileId} name={file.name} />
      </header>

      {/* 预览主体：lazy viewer + Suspense + ErrorBoundary 兜底（key 换文件重挂）。 */}
      <div className="min-h-0 flex-1">
        <PreviewErrorBoundary
          key={file.fileId}
          fallback={<UnsupportedCard file={file} kind={kind} failed />}
        >
          <React.Suspense fallback={<CenteredSpinner />}>
            <Viewer file={file} kind={kind} />
          </React.Suspense>
        </PreviewErrorBoundary>
      </div>
    </>
  )
}

/** 按 kind 路由到共享 viewer；unsupported → 降级下载卡。 */
function Viewer({ file, kind }: { file: PreviewTarget; kind: PreviewKind }) {
  switch (kind) {
    case 'pdf':
      return <PdfViewer url={file.url} name={file.name} fileId={file.fileId} />
    case 'docx':
      return <DocxViewer url={file.url} name={file.name} fileId={file.fileId} />
    case 'xlsx':
      return <ExcelViewer url={file.url} name={file.name} fileId={file.fileId} />
    case 'image':
      return <ImageViewer url={file.url} name={file.name} fileId={file.fileId} />
    case 'code':
      return <CodeViewer url={file.url} name={file.name} fileId={file.fileId} />
    default:
      return <UnsupportedCard file={file} kind={kind} />
  }
}

function CenteredSpinner() {
  return (
    // 内容区背景继承上级（资料 PreviewPane=bg-bg），不再用灰底 bg-bg-subtle。
    <div className="flex h-full items-center justify-center bg-transparent">
      <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
    </div>
  )
}

/** 未选中文件的引导空态。 */
function EmptyHint() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-text-muted">
      <MousePointerClick aria-hidden size={36} strokeWidth={1.5} className="text-text-faint" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-text">在左侧选择一个文件</p>
        <p className="text-xs text-text-muted">点击文件树中的文件，在此处在线预览。</p>
      </div>
    </div>
  )
}

/** 不支持在线预览 / 预览失败：降级下载卡（绝不白屏）。 */
function UnsupportedCard({
  file,
  kind,
  failed = false,
}: {
  file: PreviewTarget
  kind: PreviewKind
  failed?: boolean
}) {
  const ext = extOf(file.name) || extOf(file.url)
  return (
    // 内容区背景继承上级（资料 PreviewPane=bg-bg），不再用灰底 bg-bg-subtle。
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-transparent p-8 text-center">
      {failed ? (
        <FileQuestion aria-hidden size={56} strokeWidth={1.25} className="text-text-faint" />
      ) : (
        <FileTypeIcon ext={ext} className="size-14" />
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-text">{file.name}</p>
        <p className="text-xs text-text-muted">
          {failed
            ? '预览加载失败，请下载后在本地打开。'
            : kind === 'unsupported'
              ? '该文件类型暂不支持在线预览。'
              : '暂无可用预览。'}
        </p>
      </div>
      <DownloadButton fileId={file.fileId} name={file.name} variant="outline" withLabel />
    </div>
  )
}

/** 下载按钮：走 useDownload（fetch→blob→a[download]，跨源也能真正触发下载）。 */
function DownloadButton({
  fileId,
  name,
  variant = 'ghost',
  withLabel = false,
}: {
  fileId: string
  name: string
  variant?: React.ComponentProps<typeof Button>['variant']
  withLabel?: boolean
}) {
  const { download, progress } = useDownload()
  const p = progress[fileId]
  const busy = p != null && !p.done

  return (
    <Button
      variant={variant}
      size={withLabel ? 'sm' : 'icon'}
      className={cn(!withLabel && 'h-8 w-8 shrink-0')}
      aria-label="下载文件"
      title="下载文件"
      disabled={busy}
      onClick={() => void download(fileId, name)}
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
    // 仅记录；可见兜底由 fallback 承担（不在渲染期调 toast，MEMORY 警示）。
    console.error('[PreviewPane] viewer 渲染失败:', error)
  }

  override render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
