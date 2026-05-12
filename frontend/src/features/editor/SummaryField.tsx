import { useState } from 'react'
import { Sparkles, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSummaryCompose } from './ai/useSummaryCompose'

const LENGTH_OPTIONS = [60, 100, 120, 150, 200] as const

type Props = {
  value: string
  onChange: (v: string) => void
  /** Full markdown body — fed to the AI as the source to summarize. */
  content: string
}

export function SummaryField({ value, onChange, content }: Props) {
  const [maxChars, setMaxChars] = useState<number>(120)
  const [prevSummary, setPrevSummary] = useState<string | null>(null)
  const { generate, isPending } = useSummaryCompose()

  const canGenerate = !!content.trim() && !isPending

  const onGenerate = () => {
    setPrevSummary(value)
    generate(content, maxChars, (after) => onChange(after))
  }

  const onUndo = () => {
    if (prevSummary === null) return
    onChange(prevSummary)
    setPrevSummary(null)
  }

  return (
    <div className="flex items-start gap-2">
      <Textarea
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          if (prevSummary !== null) setPrevSummary(null)
        }}
        placeholder="让浏览者一眼看懂这篇笔记是什么。留空将自动取正文首段。"
        rows={2}
        aria-label="笔记简介"
        className="min-h-[52px] flex-1 resize-none text-sm"
      />
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <Select value={String(maxChars)} onValueChange={(v) => setMaxChars(Number(v))}>
            <SelectTrigger aria-label="简介字数上限" className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LENGTH_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  ≤ {n} 字
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onGenerate}
            disabled={!canGenerate}
            title={canGenerate ? 'AI 生成简介' : '请先填写正文'}
            className="h-8"
          >
            <Sparkles size={12} aria-hidden />
            {isPending ? '生成中…' : 'AI 生成'}
          </Button>
        </div>
        {prevSummary !== null && (
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex items-center gap-1 text-xs text-text-muted transition hover:text-text"
          >
            <Undo2 size={11} aria-hidden /> 撤销 AI 生成
          </button>
        )}
      </div>
    </div>
  )
}
