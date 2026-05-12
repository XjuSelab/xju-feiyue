import { useState, type KeyboardEvent } from 'react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Hash,
  Sparkles,
  Eye,
  Columns,
  Wand2,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export type EditorViewMode = 'split' | 'editor-only' | 'preview-only'

type Props = {
  tags: string[]
  wordCount: number
  viewMode: EditorViewMode
  aiOpen: boolean
  onMarkdownInsert: (snippet: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onToggleAi: () => void
  onSetViewMode: (m: EditorViewMode) => void
  /** Reset splitter back to an even split (only useful in 'split' viewMode). */
  onResetLayout: () => void
  /** Whether the editor currently has a selection long enough to polish. */
  canPolish: boolean
  /** Trigger AI polish on the current selection. */
  onPolish: () => void
}

export function SubToolbar({
  tags,
  wordCount,
  viewMode,
  aiOpen,
  onMarkdownInsert,
  onAddTag,
  onRemoveTag,
  onToggleAi,
  onSetViewMode,
  onResetLayout,
  canPolish,
  onPolish,
}: Props) {
  const [tagInput, setTagInput] = useState('')

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const v = tagInput.trim().replace(/,$/, '')
      if (v && !tags.includes(v)) onAddTag(v)
      setTagInput('')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg px-6 py-2">
      <ToolButton aria-label="粗体" onClick={() => onMarkdownInsert('**$**')}>
        <Bold size={12} aria-hidden />
      </ToolButton>
      <ToolButton aria-label="斜体" onClick={() => onMarkdownInsert('*$*')}>
        <Italic size={12} aria-hidden />
      </ToolButton>
      <ToolButton aria-label="无序列表" onClick={() => onMarkdownInsert('\n- ')}>
        <List size={12} aria-hidden />
      </ToolButton>
      <ToolButton aria-label="有序列表" onClick={() => onMarkdownInsert('\n1. ')}>
        <ListOrdered size={12} aria-hidden />
      </ToolButton>
      <ToolButton aria-label="引用" onClick={() => onMarkdownInsert('\n> ')}>
        <Quote size={12} aria-hidden />
      </ToolButton>
      <ToolButton aria-label="行内代码" onClick={() => onMarkdownInsert('`$`')}>
        <Code size={12} aria-hidden />
      </ToolButton>
      <ToolButton aria-label="链接" onClick={() => onMarkdownInsert('[$](url)')}>
        <LinkIcon size={12} aria-hidden />
      </ToolButton>

      <span className="mx-2 h-4 w-px bg-border" aria-hidden />

      <Hash size={12} aria-hidden className="text-text-faint" />
      <ul className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <li key={tag}>
            <button
              type="button"
              onClick={() => onRemoveTag(tag)}
              className="inline-flex items-center gap-0.5 rounded-sm bg-bg-subtle px-1.5 py-0.5 text-xs text-text-muted hover:bg-border hover:text-text"
            >
              {tag}
              <X size={10} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={onTagKey}
        placeholder="加标签 ↩"
        className="h-7 w-28 text-xs"
      />

      <span className="ml-auto inline-flex items-center gap-3 text-xs text-text-faint">
        <span>{wordCount} 字</span>

        <span className="inline-flex items-center gap-0.5 rounded-sm bg-bg-subtle p-0.5">
          {(['split', 'editor-only', 'preview-only'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-label={m === 'split' ? '分屏' : m === 'editor-only' ? '仅编辑器' : '仅预览'}
              aria-pressed={viewMode === m}
              onClick={() => onSetViewMode(m)}
              className={cn(
                'inline-flex size-6 items-center justify-center rounded-sm text-text-muted transition',
                viewMode === m && 'bg-bg text-text shadow-card',
              )}
            >
              <Eye size={11} aria-hidden />
            </button>
          ))}
        </span>

        {viewMode === 'split' && (
          <button
            type="button"
            aria-label="恢复栏宽平分"
            title="恢复平分"
            onClick={onResetLayout}
            className="inline-flex size-6 items-center justify-center rounded-sm text-text-muted transition hover:bg-bg-subtle hover:text-text"
          >
            <Columns size={12} aria-hidden />
          </button>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onPolish}
          disabled={!canPolish}
          title={canPolish ? '润色选中文字' : '先选中一段文字（≥ 4 字）'}
          className="h-7"
        >
          <Wand2 size={12} aria-hidden /> 润色
        </Button>

        <Button
          type="button"
          size="sm"
          variant={aiOpen ? 'default' : 'outline'}
          onClick={onToggleAi}
          className="h-7"
        >
          <Sparkles size={12} aria-hidden /> AI
        </Button>
      </span>
    </div>
  )
}

function ToolButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition hover:bg-bg-subtle hover:text-text"
    >
      {children}
    </button>
  )
}
