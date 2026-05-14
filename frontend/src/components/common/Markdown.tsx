import { Children, isValidElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { CodeBlock } from './CodeBlock'
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

// 旧版编辑器链接按钮模板是 `[$](url)`，光标停在 `[]` 里，很多作者把链接文本写好
// 后忘了替换 `url` 占位词，最终保存成 `[https://...](url)`。渲染出来 `<a href="url">`
// 是相对路径，点了会跳到 /note/url 404。下面这个救场逻辑：href 像占位/空时，
// 如果可见文本是 URL，就把文本当真正的 href。
const HREF_PLACEHOLDER = /^(url|URL|#|)$/

/**
 * Markdown — Claude 风格 prose 容器，渲染 md/gfm/math/raw-html。
 * - 内联 `code` 走 prose-claude.css 默认样式
 * - fenced ```lang code``` 委托 <CodeBlock> 渲染（带 hover 复制按钮）
 * - rehype-highlight 给 fenced code 加 .hljs-* class，由 highlight.js 主题
 *   样式上色（主题样式由消费侧按需 import，例如 import 'highlight.js/styles/github.css'）
 */
const components: Components = {
  a: ({ href, children, ...rest }) => {
    let resolvedHref = href ?? ''
    if (HREF_PLACEHOLDER.test(resolvedHref)) {
      const text = nodeToText(children).trim()
      if (URL_LIKE.test(text)) resolvedHref = text
    }
    const external = /^https?:\/\//i.test(resolvedHref)
    return (
      <a
        href={resolvedHref}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...rest}
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
