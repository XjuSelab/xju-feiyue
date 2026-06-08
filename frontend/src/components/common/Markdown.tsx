import { Children, isValidElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { CodeBlock } from './CodeBlock'
import { FileCard } from './FileCard'
import { isAttachmentHref } from '@/lib/fileTypes'
import { cn } from '@/lib/cn'

/**
 * Recursively flatten React children to plain text. rehype-highlight
 * tokenizes fenced code into nested <span class="hljs-..."> elements, so
 * `String(children)` yields "[object Object]"-soup. We need the real text
 * for the copy button.
 */
function nodeToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join('')
  if (isValidElement(node)) {
    const childProp = (node.props as { children?: ReactNode }).children
    return nodeToText(childProp)
  }
  return ''
}

type Props = {
  content: string
  className?: string
}

// "https://example.com" 这种字符串都算 URL。要求带 scheme，避免把作者写的普通
// 文本（比如 "config.json"）误判成链接。
const URL_LIKE = /^https?:\/\/\S+$/i

// 占位 / 空 href：编辑器链接按钮可能留下空壳 `[]()`，或作者忘了填网址。这些都
// 不该渲染成会跳站内 404 / 开空白页的 <a>。覆盖：空串、`#`、`url`/`URL`、以及
// 裸 scheme `http://` / `https://`（旧链接按钮的占位词）。命中后先尝试用「可见
// 文本本身就是网址」救场，救不了就退化成纯文本。
const HREF_PLACEHOLDER = /^(url|#|https?:\/\/|)$/i

// 无 scheme 但长得像主机名的网址：`www.x.com` / `google.com` / `bit.ly/abc`。
// 作者常忘了写 http(s)://，渲染成相对链接会误跳站内 404。命中后补 https:// 当外链。
// 要求最后一段是 2–24 位纯字母 TLD；站内绝对路径以 `/` 开头、锚点以 `#` 开头，都
// 走不到这里。代价：`config.json` 这类会被当成域名（→ https://config.json），但
// 本站的真实相对资源都走 /uploads 附件或 /note 绝对路径，这种输入本就是坏链。
const BARE_HOST = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}(\/[^\s]*)?$/i

// 已带 scheme（mailto: / tel: / http: …）则不补 https://。
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * Markdown — Claude 风格 prose 容器，渲染 md/gfm/math/raw-html。
 * - 内联 `code` 走 prose-claude.css 默认样式
 * - fenced ```lang code``` 委托 <CodeBlock> 渲染（带 hover 复制按钮）
 * - rehype-highlight 给 fenced code 加 .hljs-* class，由 highlight.js 主题
 *   样式上色（主题样式由消费侧按需 import，例如 import 'highlight.js/styles/github.css'）
 */
const components: Components = {
  a: ({ href, children, title }) => {
    let resolved = (href ?? '').trim()

    // 占位 / 空 href：可见文本本身是网址就拿来当目标，否则退化成纯文本——绝不渲染
    // 成会跳 404 / 开空白页的死链。
    if (HREF_PLACEHOLDER.test(resolved)) {
      const text = nodeToText(children).trim()
      resolved = URL_LIKE.test(text) ? text : ''
    }
    if (!resolved) return <>{children}</>

    const titleProp = title ? { title } : {}

    // 文档附件链接（`[文件名.ext](/uploads/...)`）渲染成 FileCard（块级、带
    // data-filecard，含预览/下载/新窗口），而非普通 <a>。
    if (isAttachmentHref(resolved)) {
      const last = resolved.split('#')[0]?.split('?')[0]?.split('/').pop() ?? ''
      const filename = nodeToText(children).trim() || last
      return <FileCard href={resolved} filename={filename} />
    }

    // 站内目录锚点（`#标题`）：交给浏览器原生滚动，不当外链。
    if (resolved.startsWith('#')) {
      return (
        <a href={resolved} {...titleProp}>
          {children}
        </a>
      )
    }

    // 无 scheme 但像主机名 → 补 https:// 当外链（修「www.x.com 误跳站内 404」）。
    if (!HAS_SCHEME.test(resolved) && BARE_HOST.test(resolved)) {
      resolved = `https://${resolved}`
    }

    const external = /^https?:\/\//i.test(resolved)
    return (
      <a
        href={resolved}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...titleProp}
      >
        {children}
      </a>
    )
  },
  // 让 CodeBlock 自己渲染 <pre>，避免 react-markdown 套两层 <pre>
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...rest }) => {
    const match = /language-(\w+)/.exec(className ?? '')
    if (match && match[1]) {
      // children here is a React subtree from rehype-highlight (token spans).
      // Flatten to text for clipboard + display so we don't render
      // "[object Object]" garbage when nodes are coerced.
      const text = nodeToText(children).replace(/\n$/, '')
      return (
        <CodeBlock
          code={text}
          language={match[1]}
          highlightedChildren={Children.toArray(children)}
        />
      )
    }
    // inline code
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    )
  },
}

export function Markdown({ content, className }: Props) {
  return (
    <div className={cn('prose-claude', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
