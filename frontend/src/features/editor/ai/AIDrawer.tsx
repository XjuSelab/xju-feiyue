import {
  Sparkles,
  Wand2,
  Scissors,
  Maximize2,
  MessageSquare,
  Languages,
  X,
  Check,
  Undo2,
  Columns2,
  AlignLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import type { AIComposeMode } from '@/api/schemas/ai'
import { DiffView } from './DiffView'
import type { ComposeHistoryItem } from './useAICompose'
import { useState } from 'react'

type Props = {
  isPending: boolean
  active: ComposeHistoryItem | null
  history: ComposeHistoryItem[]
  selectedText: string
  onCompose: (
    mode: AIComposeMode,
    text: string,
    options?: Record<string, unknown>,
  ) => void
  onAcceptAll: () => void
  onReject: () => void
  onClose: () => void
  onPickHistory: (id: string) => void
}

const OPS: { mode: AIComposeMode; label: string; icon: typeof Wand2 }[] = [
  { mode: 'polish', label: '润色', icon: Wand2 },
  { mode: 'shorten', label: '精简', icon: Scissors },
  { mode: 'expand', label: '扩写', icon: Maximize2 },
  { mode: 'tone', label: '语气', icon: MessageSquare },
  { mode: 'translate', label: '翻译', icon: Languages },
  { mode: 'custom', label: '自定义', icon: Sparkles },
]

export function AIDrawer({
  isPending,
  active,
  history,
  selectedText,
  onCompose,
  onAcceptAll,
  onReject,
  onClose,
  onPickHistory,
}: Props) {
  const [view, setView] = useState<'inline' | 'sidebyside'>('sidebyside')
  const [customPrompt, setCustomPrompt] = useState('')

  const trigger = (mode: AIComposeMode) => {
    if (mode === 'custom') {
      onCompose(mode, selectedText, { prompt: customPrompt })
    } else if (mode === 'tone') {
      onCompose(mode, selectedText, { target: 'formal' })
    } else {
      onCompose(mode, selectedText)
    }
  }

  return (
    <aside
      role="complementary"
      aria-label="AI 助手"
      className="flex h-full flex-col border-l border-border bg-bg"
    >
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-text">
          <Sparkles size={14} className="text-cat-tools" aria-hidden />
          AI 助手
        </div>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="rounded-sm p-1 text-text-muted transition hover:bg-bg-subtle hover:text-text"
        >
          <X size={14} aria-hidden />
        </button>
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          {/* Operations */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-faint">
              操作
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {OPS.map((op) => {
                const Icon = op.icon
                return (
                  <button
                    key={op.mode}
                    type="button"
                    onClick={() => trigger(op.mode)}
                    disabled={
                      isPending ||
                      (op.mode !== 'custom' && !selectedText.trim())
                    }
                    className="inline-flex flex-col items-center gap-1 rounded-md border border-border bg-bg p-2 text-xs text-text transition hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon size={14} aria-hidden />
                    {op.label}
                  </button>
                )
              })}
            </div>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="自定义指令（仅自定义 mode 使用）"
              rows={2}
              className="mt-2 text-xs"
            />
          </section>

          {/* Result */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                结果
              </h3>
              <div className="inline-flex items-center gap-0.5 rounded-sm bg-bg-subtle p-0.5">
                <button
                  type="button"
                  aria-label="并排对比"
                  aria-pressed={view === 'sidebyside'}
                  onClick={() => setView('sidebyside')}
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded-sm',
                    view === 'sidebyside'
                      ? 'bg-bg text-text shadow-card'
                      : 'text-text-muted',
                  )}
                >
                  <Columns2 size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="行内对比"
                  aria-pressed={view === 'inline'}
                  onClick={() => setView('inline')}
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded-sm',
                    view === 'inline'
                      ? 'bg-bg text-text shadow-card'
                      : 'text-text-muted',
                  )}
                >
                  <AlignLeft size={12} aria-hidden />
                </button>
              </div>
            </div>
            {isPending ? (
              <p className="rounded-md border border-border bg-bg-subtle p-3 text-xs text-text-muted">
                生成中…
              </p>
            ) : active ? (
              <DiffView segments={active.segments} view={view} />
            ) : (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-text-faint">
                选中文字 → 点上方一个 mode → 这里出现 diff
              </p>
            )}
            {active && !isPending && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={onAcceptAll}>
                  <Check size={12} aria-hidden /> 全部采纳
                </Button>
                <Button size="sm" variant="outline" onClick={onReject}>
                  <X size={12} aria-hidden /> 拒绝
                </Button>
                <span className="ml-auto self-center text-xs text-text-faint">
                  {active.elapsedMs} ms
                </span>
              </div>
            )}
          </section>

          {/* History */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-faint">
              历史
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-text-faint">暂无历史。</p>
            ) : (
              <ul className="space-y-1">
                {history.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => onPickHistory(h.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left text-xs transition hover:bg-bg-subtle',
                        active?.id === h.id && 'bg-bg-subtle',
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5 text-text-muted">
                        <Undo2 size={11} aria-hidden /> {modeLabel(h.mode)}
                      </span>
                      <span className="truncate text-text-faint">
                        {h.before.slice(0, 24)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>
    </aside>
  )
}

function modeLabel(mode: AIComposeMode): string {
  return (
    OPS.find((o) => o.mode === mode)?.label ?? mode
  )
}
