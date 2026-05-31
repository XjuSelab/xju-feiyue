import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
// 表格网格样式（库不自注入主样式）。本文件被 React.lazy 包，CSS 随 lazy chunk 加载，首屏零增。
import '@js-preview/excel/lib/index.css'

import type { JsExcelPreview } from '@js-preview/excel'

import { resolveAssetUrl } from '@/api/client'

/**
 * ExcelViewer —— @js-preview/excel 表格预览（仅 `.xlsx`，旧版 `.xls` 走降级卡）。
 *
 * 关键实现（已拍板预览栈）：
 * - lazy `import('@js-preview/excel')` → `init(container)` 拿命令式实例 → `preview(arrayBuffer)`。
 *   （库内含 exceljs ~1MB，必须 lazy；本文件被 React.lazy 包，整块进独立 chunk。）
 * - 卸载 / 换文件 `destroy()` 释放实例 + 清空容器，防内存泄漏。
 * - 渲染失败 throw → FilePreviewDialog 兜底降级，绝不白屏。
 * - 500ms 延迟 spinner。
 */

type Props = {
  url: string
  name: string
  fileId?: string | undefined
}

export default function ExcelViewer({ url, name }: Props) {
  const [loading, setLoading] = useState(true)
  const [showSpinner, setShowSpinner] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<JsExcelPreview | null>(null)
  const token = useRef(0)

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

    ;(async () => {
      const res = await fetch(resolveAssetUrl(url), { signal: abort.signal })
      if (!res.ok) throw new Error(`表格加载失败（${res.status}）`)
      const buf = await res.arrayBuffer()
      if (my !== token.current) return
      const { default: jsExcelPreview } = await import('@js-preview/excel')
      if (my !== token.current) return
      const instance = jsExcelPreview.init(container)
      instanceRef.current = instance
      await instance.preview(buf)
      if (my !== token.current) return
      setLoading(false)
    })().catch((err) => {
      if (abort.signal.aborted) return
      if (my !== token.current) return
      throw err
    })

    return () => {
      abort.abort()
      token.current += 1
      try {
        instanceRef.current?.destroy()
      } catch {
        /* 已卸载 / 未初始化：忽略 */
      }
      instanceRef.current = null
      container.replaceChildren()
    }
  }, [url])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={containerRef}
        aria-label={`${name} 表格预览`}
        className="min-h-0 flex-1 overflow-auto bg-bg-subtle"
      />
      {showSpinner && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      )}
    </div>
  )
}
