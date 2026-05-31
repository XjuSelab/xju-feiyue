import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import 'highlight.js/styles/github.css'

import { resolveAssetUrl } from '@/api/client'
import { Button } from '@/components/ui/button'

/**
 * CodeViewer —— 纯文本 / 代码预览：fetch 文本 → highlight.js `highlightAuto` → `<pre>`。
 *
 * 关键实现（已拍板预览栈：highlight.js 已装，自动转义，不需 dompurify）：
 * - `hljs.highlightAuto(text)` 返回的 `.value` 是已 HTML 转义 + 包 `<span class="hljs-*">` 的安全串
 *   （highlight.js 对原文 `<` `&` 等做了 escape，故 `dangerouslySetInnerHTML` 安全）。
 * - lazy `import('highlight.js')`：把核心库推进 viewer 的 lazy chunk，不进首屏。
 * - 复制按钮：navigator.clipboard 写原始文本。
 * - 超大文本截断 + 提示，避免 highlight 卡死主线程。
 * - fetch 失败 throw → FilePreviewDialog 兜底降级。
 */

type Props = {
  url: string
  name: string
  fileId?: string | undefined
}

/** highlight 输入上限：超过则截断（仅预览，完整内容走下载）。 */
const MAX_TEXT_CHARS = 500_000

export default function CodeViewer({ url, name }: Props) {
  const [loading, setLoading] = useState(true)
  const [html, setHtml] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [copied, setCopied] = useState(false)
  const rawTextRef = useRef('')
  const token = useRef(0)

  useEffect(() => {
    const my = ++token.current
    const abort = new AbortController()
    setLoading(true)
    setHtml('')
    setTruncated(false)

    ;(async () => {
      const res = await fetch(resolveAssetUrl(url), { signal: abort.signal })
      if (!res.ok) throw new Error(`文件加载失败（${res.status}）`)
      let text = await res.text()
      if (my !== token.current) return
      if (text.length > MAX_TEXT_CHARS) {
        text = text.slice(0, MAX_TEXT_CHARS)
        setTruncated(true)
      }
      rawTextRef.current = text
      const hljs = (await import('highlight.js')).default
      if (my !== token.current) return
      // highlightAuto 的 .value 已转义并包 hljs token span，可安全注入。
      const result = hljs.highlightAuto(text)
      if (my !== token.current) return
      setHtml(result.value)
      setLoading(false)
    })().catch((err) => {
      if (abort.signal.aborted) return
      if (my !== token.current) return
      throw err
    })

    return () => {
      abort.abort()
      token.current += 1
    }
  }, [url])

  const onCopy = () => {
    navigator.clipboard
      .writeText(rawTextRef.current)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        /* clipboard 不可用：静默忽略 */
      })
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* 工具栏 */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-strong bg-bg-subtle px-3 py-1.5">
        <span className="truncate text-xs text-text-faint">
          {name}
          {truncated && '（预览已截断，完整内容请下载）'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onCopy}
          disabled={loading || !rawTextRef.current}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制'}
        </Button>
      </div>

      {/* 滚动区 */}
      <div className="min-h-0 flex-1 overflow-auto bg-bg-subtle">
        <pre className="hljs m-0 p-4 text-xs leading-relaxed">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
        </div>
      )}
    </div>
  )
}
