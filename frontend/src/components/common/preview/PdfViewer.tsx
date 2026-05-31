import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist'
// Vite `?url`：把 worker 打成独立资源、返回最终 URL（不进首屏 chunk）。
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import { Button } from '@/components/ui/button'
import { usePreviewZoom } from './usePreviewZoom'

/**
 * PdfViewer —— pdfjs-dist 多页逐页懒加载渲染。资料页与写作栏附件预览共用。
 *
 * 关键实现（plan-materials-integration.md「预览」+ 角色清单）：
 * - worker 用 Vite `?url` import 设 `GlobalWorkerOptions.workerSrc`（本地资源、零外网 CDN）。
 * - cmaps 暂未配置（见下方常量处注释）：仅未内嵌 CJK 字体的 PDF 才需要，先去掉以免打挂渲染。
 * - HiDPI：每页 canvas 按 `outputScale = devicePixelRatio` 放大像素、CSS 尺寸不变，retina 清晰。
 * - 懒加载：doc 打开后只读每页 base 尺寸建「占位容器」（按 fit*zoom 预算好宽高、避免布局跳动），
 *   用 IntersectionObserver 监听滚动区，占位进入视口（含 300px rootMargin 预加载）才真正 render
 *   canvas；离开视口保留已渲染（大文件首屏只渲可见页，不必等全部渲完即可显示）。
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

/** 每页 base（scale=1）尺寸，doc 打开后一次性读取，用于预算占位尺寸。 */
type PageSize = { width: number; height: number }

export default function PdfViewer({ url, name, fileId }: Props) {
  const { zoom, zoomIn, zoomOut, reset } = usePreviewZoom('pdf', fileId ?? url, 1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showSpinner, setShowSpinner] = useState(false)
  // 每页 base 尺寸（scale=1），与 docRef 同批次产出；用于占位预算。
  const [pageSizes, setPageSizes] = useState<PageSize[]>([])

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

  // 打开/换文件：拉 ArrayBuffer → getDocument → 读每页 base 尺寸建占位。
  useEffect(() => {
    const token = ++renderToken.current
    const abort = new AbortController()
    let cancelledDoc: PDFDocumentProxy | null = null
    setLoading(true)
    setPageCount(0)
    setPageSizes([])

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

      // 仅读每页 base（scale=1）尺寸（不渲染，开销小）→ 占位可立刻按尺寸排版。
      const sizes: PageSize[] = []
      for (let i = 1; i <= doc.numPages; i += 1) {
        if (token !== renderToken.current) return
        const page = await doc.getPage(i)
        if (token !== renderToken.current) return
        const base = page.getViewport({ scale: 1 })
        sizes.push({ width: base.width, height: base.height })
      }
      if (token !== renderToken.current) return
      setPageSizes(sizes)
      setPageCount(doc.numPages)
      // 占位已可显示，收起 loading（可见页随后由 IO 渲染）。
      setLoading(false)
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

  // pageSizes / zoom / fitWidth 变化时：重建占位 + 装 IntersectionObserver 懒渲染。
  // 缩放/适宽变化会重新进入本 effect → 重算所有占位尺寸 + 对可见页重渲。
  useEffect(() => {
    const doc = docRef.current
    const host = canvasHostRef.current
    const scroller = scrollRef.current
    if (!doc || !host || !scroller || pageSizes.length === 0) return

    const token = ++renderToken.current
    const tasks: RenderTask[] = []
    let disposed = false

    const outputScale = window.devicePixelRatio || 1
    // 标记每页是否已（开始）渲染，避免 IO 反复触发重渲已渲页。
    const rendered = new Array<boolean>(pageSizes.length).fill(false)
    const placeholders: HTMLDivElement[] = []

    host.replaceChildren()

    // 按 base 尺寸 × fit*zoom 预算每页占位的 CSS 宽高（与真实 canvas 一致），避免布局跳动。
    for (let i = 0; i < pageSizes.length; i += 1) {
      const size = pageSizes[i]
      if (!size) continue
      const fitScale = fitWidth > 0 ? fitWidth / size.width : 1
      const scale = fitScale * zoom
      const cssW = Math.floor(size.width * scale)
      const cssH = Math.floor(size.height * scale)

      const placeholder = document.createElement('div')
      placeholder.className = 'mx-auto mb-4 shadow-card rounded-sm bg-white'
      placeholder.style.width = `${cssW}px`
      placeholder.style.height = `${cssH}px`
      placeholder.dataset.pageIndex = String(i)
      placeholder.setAttribute('aria-label', `${name} 第 ${i + 1} 页`)
      host.appendChild(placeholder)
      placeholders.push(placeholder)
    }

    const renderPage = async (index: number) => {
      if (disposed || token !== renderToken.current) return
      if (rendered[index]) return
      rendered[index] = true

      const placeholder = placeholders[index]
      if (!placeholder) return
      const page = await doc.getPage(index + 1)
      if (disposed || token !== renderToken.current) return

      const base = page.getViewport({ scale: 1 })
      const fitScale = fitWidth > 0 ? fitWidth / base.width : 1
      const viewport = page.getViewport({ scale: fitScale * zoom })

      const canvas = document.createElement('canvas')
      canvas.className = 'block'
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (disposed || token !== renderToken.current) return
      placeholder.replaceChildren(canvas)

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

    // 占位进入视口（含 300px 预加载边距）才渲染该页；离开视口保留已渲染 canvas。
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const idx = Number((entry.target as HTMLElement).dataset.pageIndex)
          if (Number.isNaN(idx)) continue
          void renderPage(idx).catch((err) => {
            if (disposed || token !== renderToken.current) return
            throw err
          })
        }
      },
      { root: scroller, rootMargin: '300px 0px' },
    )
    for (const ph of placeholders) io.observe(ph)

    return () => {
      disposed = true
      io.disconnect()
      for (const t of tasks) t.cancel()
    }
  }, [pageSizes, zoom, fitWidth, name])

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
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-transparent p-4">
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
