import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = {
  /** Plain-text source for the clipboard. Always required. */
  code: string
  language?: string
  className?: string
  /**
   * Optional rich children (e.g. rehype-highlight token spans) to render
   * inside the <code> tag. When omitted, falls back to `code`.
   */
  highlightedChildren?: ReactNode
}

/**
 * CodeBlock — prose-claude 内 fenced code 的渲染组件。
 * 行为：
 * - hover 显示右上角复制按钮（focus-within 也显示，便于键盘可达）
 * - 点击 `navigator.clipboard.writeText`，按钮态切到 "Copied" 1.5s
 * - 左上角显示 language label（如 ```python ... ``` → "python"）
 */
export function CodeBlock({ code, language, className, highlightedChildren }: Props) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      // 静默失败：clipboard 在 http context 可能无权限；R3+ 可加 toast
      console.warn('clipboard write failed', err)
    }
  }

  return (
    <pre className={cn('group relative leading-7', className)}>
      {language ? (
        <span className="pointer-events-none absolute left-2.5 top-2 select-none rounded-sm bg-bg px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-text-faint">
          {language}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        className={cn(
          'absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs transition focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          copied
            ? 'bg-emerald-50 text-emerald-700 opacity-100'
            : 'bg-bg text-text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {copied ? (
          <Check size={12} aria-hidden className="text-emerald-600" />
        ) : (
          <Copy size={12} aria-hidden />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <code
        className={cn(
          'block',
          language ? `language-${language}` : undefined,
          // !pt-8 — prose-claude.css resets `.prose-claude pre code { padding: 0 }`,
          // so we need the important prefix for our top padding to win and keep
          // the first code line clear of the absolute lang label + copy button.
          language ? '!pt-8' : undefined,
        )}
      >
        {highlightedChildren ?? code}
      </code>
    </pre>
  )
}
