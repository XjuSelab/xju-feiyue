import { memo, forwardRef } from 'react'
import { Markdown } from '@/components/common/Markdown'
import { cn } from '@/lib/cn'

type Props = {
  content: string
  className?: string
}

/**
 * MarkdownPreview — 预览面板。复用 R2 的 <Markdown />，套 .prose-claude。
 * memo 避免编辑期 keystroke 频繁重渲，由 WritePage 上游 debounce 控制。
 */
export const MarkdownPreview = memo(
  forwardRef<HTMLDivElement, Props>(function MarkdownPreview(
    { content, className },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          'h-full overflow-y-auto bg-bg px-6 py-6',
          className,
        )}
      >
        {content.trim() ? (
          <Markdown content={content} />
        ) : (
          <div className="prose-claude">
            <p className="text-text-faint">在左侧编辑器开始写作，预览会同步出现在这里。</p>
          </div>
        )}
      </div>
    )
  }),
)
