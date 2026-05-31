import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import { Button } from '@/components/ui/button'
import { ZOOM_MAX, ZOOM_MIN, usePreviewZoom } from './usePreviewZoom'

/**
 * ImageViewer —— 原生 `<img>` + CSS transform 缩放。
 *
 * 关键实现：
 * - `onLoad` 自动 contain 适配（autoFit）：按图片自然尺寸与容器尺寸取较小比例，
 *   超大图缩进容器、小图不放大（max 1）。
 * - Ctrl + 滚轮缩放：`addEventListener('wheel', …, { passive:false })` 才能 `preventDefault`
 *   阻止页面滚动（React onWheel 默认 passive，无法 preventDefault）。
 * - per-file zoom 缓存（usePreviewZoom），与 PDF/DOCX 同一套上下限。
 * - 加载失败 throw（onError）→ FilePreviewDialog 兜底降级。
 */

type Props = {
  url: string
  name: string
  fileId?: string | undefined
}

export default function ImageViewer({ url, name, fileId }: Props) {
  const { zoom, setZoom, zoomIn, zoomOut } = usePreviewZoom('image', fileId ?? url, 1)
  const [loading, setLoading] = useState(true)
  const [errored, setErrored] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // 加载失败：throw 让上层 ErrorBoundary 兜底。
  if (errored) throw new Error('图片加载失败')

  const autoFit = useCallback(() => {
    const host = scrollRef.current
    const img = imgRef.current
    if (!host || !img || !img.naturalWidth) return
    const availW = host.clientWidth - 32
    const availH = host.clientHeight - 32
    const fit = Math.min(availW / img.naturalWidth, availH / img.naturalHeight, 1)
    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fit || 1)))
  }, [setZoom])

  const onLoad = useCallback(() => {
    setLoading(false)
    autoFit()
  }, [autoFit])

  // Ctrl + 滚轮缩放（passive:false 才能 preventDefault）。
  useEffect(() => {
    const host = scrollRef.current
    if (!host) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.1 : -0.1
      setZoom((z) => z + delta)
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [setZoom])

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
          onClick={autoFit}
          aria-label="适应窗口"
          title="适应窗口"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-xs text-text-faint">Ctrl + 滚轮缩放</span>
      </div>

      {/* 滚动区 */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-transparent p-4"
      >
        <img
          ref={imgRef}
          src={resolveAssetUrl(url)}
          alt={name}
          onLoad={onLoad}
          onError={() => setErrored(true)}
          draggable={false}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          className="max-w-none select-none"
        />
      </div>

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      )}
    </div>
  )
}
