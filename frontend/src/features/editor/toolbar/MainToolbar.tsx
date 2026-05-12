import { Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORIES, type CategoryId } from '@/lib/categories'

type Props = {
  title: string
  category: CategoryId
  onTitleChange: (v: string) => void
  onCategoryChange: (c: CategoryId) => void
  onSave: () => void
  onPublish: () => void
  publishing?: boolean
  savedAt?: string
  /** 'new' (default): 保存草稿 + 发布; 'edit': 编辑已发布笔记，发布按钮变 "保存修改" */
  mode?: 'new' | 'edit'
}

export function MainToolbar({
  title,
  category,
  onTitleChange,
  onCategoryChange,
  onSave,
  onPublish,
  publishing = false,
  savedAt,
  mode = 'new',
}: Props) {
  const isEdit = mode === 'edit'
  return (
    <header className="flex h-12 items-center gap-3 border-b border-border bg-bg px-6">
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="无题草稿"
        aria-label="笔记标题"
        className="h-8 max-w-md flex-1 border-0 bg-transparent font-serif text-lg font-semibold focus-visible:ring-0"
      />
      <Select value={category} onValueChange={(v) => onCategoryChange(v as CategoryId)}>
        <SelectTrigger aria-label="选择分类" className="h-8 w-32 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: `var(${c.colorVar})` }}
                />
                {c.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {savedAt && <span className="ml-auto text-xs text-text-faint">已保存 · {savedAt}</span>}

      {!isEdit && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSave}
          className={savedAt ? '' : 'ml-auto'}
        >
          <Save size={12} aria-hidden /> 保存草稿
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        onClick={onPublish}
        disabled={publishing}
        className={isEdit && !savedAt ? 'ml-auto' : ''}
      >
        <Send size={12} aria-hidden />{' '}
        {publishing ? (isEdit ? '保存中…' : '发布中…') : isEdit ? '保存修改' : '发布'}
      </Button>
    </header>
  )
}
