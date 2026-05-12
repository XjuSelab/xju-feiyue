import { useState } from 'react'
import { Loader2, Sparkles, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import { useSummaryCompose } from './ai/useSummaryCompose'

type Props = {
  value: string
  onChange: (v: string) => void
  /** Full markdown body — fed to the AI as the source to summarize. */
  content: string
  /** Note title — passed to AI so the summary doesn't restate the title. */
  title?: string
}

export function SummaryField({ value, onChange, content, title }: Props) {
  const [prevSummary, setPrevSummary] = useState<string | null>(null)
  const { generate, isPending } = useSummaryCompose()

  const canGenerate = !!content.trim() && !isPending

  const onGenerate = () => {
    setPrevSummary(value)
    // Clear immediately so the streaming chunks visibly type out from empty.
    onChange('')
    generate({
      content,
      ...(title !== undefined ? { title } : {}),
      onProgress: (current) => onChange(current),
      onDone: (final) => onChange(final),
    })
  }

  const onUndo = () => {
    if (prevSummary === null) return
    onChange(prevSummary)
    setPrevSummary(null)
  }

  return (
    <div className="flex items-start gap-2">
      <div className="relative flex-1">
        <Textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (prevSummary !== null) setPrevSummary(null)
          }}
          placeholder="让浏览者一眼看懂这篇笔记是什么。留空发布时将自动用 AI 总结。"
          rows={2}
          aria-label="笔记简介"
          readOnly={isPending}
          className={cn(
            'min-h-[52px] resize-none text-sm transition',
            isPending && 'animate-pulse ring-2 ring-cat-tools/40',
          )}
        />
        {isPending && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-2 inline-flex items-center gap-1.5 rounded-sm bg-bg/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cat-tools backdrop-blur"
          >
            <Loader2 size={10} className="animate-spin" /> AI 生成中
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onGenerate}
          disabled={!canGenerate}
          title={canGenerate ? 'AI 生成简介（流式）' : '请先填写正文'}
          className="h-8"
        >
          {isPending ? (
            <>
              <Loader2 size={12} className="animate-spin" aria-hidden /> 生成中…
            </>
          ) : (
            <>
              <Sparkles size={12} aria-hidden /> AI 生成
            </>
          )}
        </Button>
        {prevSummary !== null && !isPending && (
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex items-center gap-1 text-xs text-text-muted transition hover:text-text"
          >
            <Undo2 size={11} aria-hidden /> 撤销
          </button>
        )}
      </div>
    </div>
  )
}
