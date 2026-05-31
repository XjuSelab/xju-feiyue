import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist'
// Vite `?url`：把 worker 打成独立资源、返回最终 URL（不进首屏 chunk）。
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import { Button } from '@/components/ui/button'
import { usePreviewZoom } from './usePreviewZoom'

/**
 * PdfViewer —— pdfjs-dist 多页连续渲染。资料页与写作栏附件预览共用。
 *
 * 关键实现（plan-materials-integration.md「预览」+ 角色清单）：
 * - worker 用 Vite `?url` import 设 `GlobalWorkerOptions.workerSrc`（本地资源、零外网 CDN）。
 * - cmaps 暂未配置（见下方常量处注释）：仅未内嵌 CJK 字体的 PDF 才需要，先去掉以免打挂渲染。
 * - HiDPI：每页 canvas 按 `outputScale = devicePixelRatio` 放大像素、CSS 尺寸不变，retina 清晰。
 * - 竞态取消：`renderToken` useRef 标记当次渲染批次，缩放/换文件时旧批次 render 任务全部 cancel。
 * - 缓存三级：module 级 ArrayBuffer 缓存（同 url 二次打开零网络）+ per-file zoom（usePreviewZoom）。
 * - 500ms 延迟 spinner：快文件不闪 Loader2。
 * - 渲染失败 throw → 由 FilePreviewDialog 的 ErrorBoundary / catch 兜底降级，绝不白屏。
 */

type Props = {
  url: string
  name: string
  fileId?: string | undefined
}

// worker 只需设一次（module 级）。
GlobalWorkerOptions.workerSrc = workerUrl

// cmaps 暂不配置：`new URL('pdfjs-dist/cmaps/', import.meta.url)` 在 Vite 下会被
// 当成相对模块路径解析（→ /src/.../preview/pdfjs-dist/cmaps，且尾斜杠丢失），
// getDocument 直接抛 "Invalid factory url" 把所有 PDF 渲染都打挂。cmaps 仅在
// PDF 用「未内嵌的 CID-keyed 中文字体」时才需要（绝大多数 PDF 自带内嵌字体），
// 故先去掉以恢复通用渲染。若日后出现中文缺字，再用 vite-plugin-static-copy 把
// node_modules/pdfjs-dist/cmaps 拷到 public 并设 cMapUrl='/<copied>/'。

/** module 级 ArrayBuffer 缓存：key=url；同一文件二次打开零网络。 */
const bufferCache = new Map<string, ArrayBuffer>()

async function loadBuffer(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const cached = bufferCache.get(url)
  if (cached) return cached
  const res = await fetch(resolveAssetUrl(url), { signal })
  if (!res.ok) throw new Error(`PDF 加载失败（${res.status}）`)
  const buf = await res.arrayBuffer()
  bufferCache.set(url, buf)
  return buf
}

export default function PdfViewer({ url, name, fileId }: Props) {
  const { zoom, zoomIn, zoomOut, reset } = usePreviewZoom('pdf', fileId ?? url, 1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showSpinner, setShowSpinner] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  // 竞态取消：每次渲染批次自增，旧批次的异步回调据此自我放弃。
  const renderToken = useRef(0)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  // 「适宽」目标：容器内宽（px）。0 = 未测量，按 zoom 直绘。
  const [fitWidth, setFitWidth] = useState(0)

  // 延迟 500ms 才显 spinner，快文件不闪烁。
  useEffect(() => {
    if (!loading) {
      setShowSpinner(false)
      return
    }
    const t = window.setTimeout(() => setShowSpinner(true), 500)
    return () => window.clearTimeout(t)
  }, [loading])

  // 测量容器内宽用于「适宽」基准（减去内边距）。
  useEffect(() => {
    const host = scrollRef.current
    if (!host) return
    const measure = () => setFitWidth(Math.max(0, host.clientWidth - 32))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  // 打开/换文件：拉 ArrayBuffer → getDocument。
  useEffect(() => {
    const token = ++renderToken.current
    const abort = new AbortController()
    let cancelledDoc: PDFDocumentProxy | null = null
    setLoading(true)
    setPageCount(0)

    ;(async () => {
      const buf = await loadBuffer(url, abort.signal)
      if (token !== renderToken.current) return
      // 传 buffer 的 slice 副本：pdfjs 会 transfer/detach 底层 buffer，缓存需保留原始。
      const task = getDocument({ data: buf.slice(0) })
      const doc = await task.promise
      if (token !== renderToken.current) {
        cancelledDoc = doc
        void doc.destroy()
        return
      }
      docRef.current = doc
      cancelledDoc = doc
      setPageCount(doc.numPages)
    })().catch((err) => {
      if (abort.signal.aborted) return
      if (token !== renderToken.current) return
      // 交给上层兜底（Dialog catch / ErrorBoundary）。
      throw err
    })

    return () => {
      abort.abort()
      // 仅销毁本批次自己创建的 doc（避免销毁后继批次的 doc）。
      if (cancelledDoc && docRef.current === cancelledDoc) docRef.current = null
      void cancelledDoc?.destroy()
    }
  }, [url])

  // pageCount / zoom / fitWidth 变化时（重）渲染全部页面到 canvas。
  useEffect(() => {
    const doc = docRef.current
    const host = canvasHostRef.current
    if (!doc || !host || pageCount === 0) return

    const token = ++renderToken.current
    const tasks: RenderTask[] = []
    let disposed = false
    setLoading(true)
    host.replaceChildren()

    const outputScale = window.devicePixelRatio || 1

    const renderPage = async (page: PDFPageProxy, index: number) => {
      // 基准 viewport（scale=1）→ 适宽系数 × 用户 zoom。
      const base = page.getViewport({ scale: 1 })
      const fitScale = fitWidth > 0 ? fitWidth / base.width : 1
      const viewport = page.getViewport({ scale: fitScale * zoom })

      const canvas = document.createElement('canvas')
      canvas.className = 'block mx-auto mb-4 shadow-card rounded-sm bg-white'
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      canvas.setAttribute('aria-label', `${name} 第 ${index + 1} 页`)

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (disposed || token !== renderToken.current) return
      host.appendChild(canvas)

      const task = page.render({
        canvas,
        canvasContext: ctx,
        viewport,
        ...(outputScale !== 1
          ? { transform: [outputScale, 0, 0, outputScale, 0, 0] }
          : {}),
      })
      tasks.push(task)
      await task.promise.catch((err: unknown) => {
        // RenderingCancelledException：竞态取消，吞掉；其余照抛。
        const name_ = (err as { name?: string } | null)?.name
        if (name_ === 'RenderingCancelledException') return
        throw err
      })
    }

    ;(async () => {
      for (let i = 1; i <= doc.numPages; i += 1) {
        if (disposed || token !== renderToken.current) return
        const page = await doc.getPage(i)
        if (disposed || token !== renderToken.current) return
        await renderPage(page, i - 1)
      }
      if (!disposed && token === renderToken.current) setLoading(false)
    })().catch((err) => {
      if (disposed || token !== renderToken.current) return
      throw err
    })

    return () => {
      disposed = true
      for (const t of tasks) t.cancel()
    }
  }, [pageCount, zoom, fitWidth, name])

  // 卸载销毁文档。
  useEffect(
    () => () => {
      void docRef.current?.destroy()
      docRef.current = null
    },
    [],
  )

  const onFitWidth = useCallback(() => reset(), [reset])

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
          onClick={onFitWidth}
          aria-label="适应宽度（重置 100%）"
          title="适应宽度"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        {pageCount > 0 && (
          <span className="ml-2 text-xs text-text-faint">共 {pageCount} 页</span>
        )}
      </div>

      {/* 滚动区 + canvas host */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-bg-subtle p-4">
        <div ref={canvasHostRef} className="mx-auto" />
      </div>

      {showSpinner && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      )}
    </div>
  )
}
