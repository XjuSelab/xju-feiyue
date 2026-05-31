import { useEffect, useRef, useState } from 'react'
import { Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import { Button } from '@/components/ui/button'
import { usePreviewZoom } from './usePreviewZoom'

/**
 * DocxViewer —— docx-preview `renderAsync` 高保真渲染（仅 `.docx`，旧版 `.doc` 走降级卡）。
 *
 * 关键实现（已拍板预览栈：docx-preview 自渲染，不用 mammoth / dompurify）：
 * - `renderAsync(buffer, container)` 把 OOXML 渲染进 ref 容器（自带 wrapper / 分页 / 样式）。
 * - 缩放用 CSS `transform: scale()`（docx-preview 输出固定像素页面，scale 不重排、零重渲染）。
 * - 渲染失败直接 throw → 交给 FilePreviewDialog 的 ErrorBoundary / catch 降级，绝不白屏。
 * - 500ms 延迟 spinner：快文件不闪 Loader2。
 * - 竞态：换文件 / 卸载时 token 自增让旧批次回调自我放弃，并清空容器。
 */

type Props = {
  url: string
  name: string
  fileId?: string | undefined
}

export default function DocxViewer({ url, name, fileId }: Props) {
  const { zoom, zoomIn, zoomOut, reset } = usePreviewZoom('docx', fileId ?? url, 1)
  const [loading, setLoading] = useState(true)
  const [showSpinner, setShowSpinner] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const token = useRef(0)

  // 延迟 spinner。
  useEffect(() => {
    if (!loading) {
      setShowSpinner(false)
      return
    }
    const t = window.setTimeout(() => setShowSpinner(true), 500)
    return () => window.clearTimeout(t)
  }, [loading])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const my = ++token.current
    const abort = new AbortController()
    setLoading(true)
    container.replaceChildren()

    ;(async () => {
      const res = await fetch(resolveAssetUrl(url), { signal: abort.signal })
      if (!res.ok) throw new Error(`文档加载失败（${res.status}）`)
      const blob = await res.blob()
      if (my !== token.current) return
      const { renderAsync } = await import('docx-preview')
      if (my !== token.current) return
      await renderAsync(blob, container, undefined, {
        className: 'docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        experimental: true,
        useBase64URL: true,
      })
      if (my !== token.current) return
      setLoading(false)
    })().catch((err) => {
      if (abort.signal.aborted) return
      if (my !== token.current) return
      throw err
    })

    return () => {
      abort.abort()
      // token 自增让上面的 async 回调全部失效。
      token.current += 1
      container.replaceChildren()
    }
  }, [url])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* 缩放工具栏 */}
      <div className="flex shrink-0 items-center justify-center gap-1 border-b border-border-strong bg-bg-subtle px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={zoomOut}
          aria-label="缩小"
          title="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums text-text-muted">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={zoomIn}
          aria-label="放大"
          title="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={reset}
          aria-label="重置 100%"
          title="重置"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 滚动区 */}
      <div className="min-h-0 flex-1 overflow-auto bg-transparent p-4">
        <div
          ref={containerRef}
          aria-label={`${name} 文档预览`}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            width: zoom !== 1 ? `${100 / zoom}%` : undefined,
          }}
        />
      </div>

      {showSpinner && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      )}
    </div>
  )
}
