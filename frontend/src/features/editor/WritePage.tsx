import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useDraftStore } from '@/stores/draftStore'
import { cn } from '@/lib/cn'
import type { CategoryId } from '@/lib/categories'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { MainToolbar } from './toolbar/MainToolbar'
import { SubToolbar, type EditorViewMode } from './toolbar/SubToolbar'
import { AIDrawer } from './ai/AIDrawer'
import { FloatingToolbar } from './ai/FloatingToolbar'
import { useAICompose } from './ai/useAICompose'
import { useAutoSave } from './hooks/useAutoSave'
import { useScrollSync } from './hooks/useScrollSync'

const FLOAT_THRESHOLD = 4

export function WritePage() {
  const { draftId } = useParams<{ draftId: string }>()

  const drafts = useDraftStore((s) => s.drafts)
  const currentId = useDraftStore((s) => s.currentId)
  const ensureCurrent = useDraftStore((s) => s.ensureCurrent)
  const loadDraft = useDraftStore((s) => s.loadDraft)
  const updateDraft = useDraftStore((s) => s.updateDraft)
  const saveDraft = useDraftStore((s) => s.saveDraft)
  const draft = currentId ? (drafts[currentId] ?? null) : null

  // Initial load: route param > existing current > new
  useEffect(() => {
    if (draftId) {
      loadDraft(draftId)
    } else if (!currentId) {
      ensureCurrent()
    }
  }, [draftId, currentId, loadDraft, ensureCurrent])

  const [viewMode, setViewMode] = useState<EditorViewMode>('split')
  const [aiOpen, setAiOpen] = useState(false)
  const [selection, setSelection] = useState<{
    text: string
    from: number
    to: number
    rect: { x: number; y: number } | null
  }>({ text: '', from: 0, to: 0, rect: null })

  const editorScrollRef = useRef<HTMLElement | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  useScrollSync(editorScrollRef, previewScrollRef, viewMode === 'split')

  const {
    compose,
    isPending,
    active,
    history,
    setActive,
    clearActive,
  } = useAICompose()

  // Autosave when draft body changes
  useAutoSave(
    [draft?.title, draft?.content, draft?.category, draft?.tags?.join(',')],
    saveDraft,
  )

  const wordCount = useMemo(
    () =>
      (draft?.content ?? '').replace(/\s+/g, '').length,
    [draft?.content],
  )

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        正在准备草稿…
      </div>
    )
  }

  const onContentChange = (v: string) => updateDraft({ content: v })
  const onTitleChange = (v: string) => updateDraft({ title: v })
  const onCategoryChange = (c: CategoryId) => updateDraft({ category: c })
  const onAddTag = (tag: string) =>
    updateDraft({ tags: [...draft.tags, tag] })
  const onRemoveTag = (tag: string) =>
    updateDraft({ tags: draft.tags.filter((t) => t !== tag) })

  // Insert markdown snippet at end of content (CodeMirror-aware insertion is
  // a future enhancement; this is the dumb-but-correct fallback).
  const onMarkdownInsert = (snippet: string) => {
    const cleaned = snippet.replace(/\$/g, '')
    onContentChange(`${draft.content}${cleaned}`)
  }

  const onAcceptAll = () => {
    if (!active) return
    if (selection.from !== selection.to) {
      const next =
        draft.content.slice(0, selection.from) +
        active.after +
        draft.content.slice(selection.to)
      onContentChange(next)
    } else {
      onContentChange(active.after)
    }
    toast.success('已应用 AI 修改')
    clearActive()
  }

  const onPublish = () => {
    toast.message('发布功能尚在 R5+', {
      description: '当前为 mock 数据层；接通真后端时启用。',
    })
  }

  // Editor 35 / Preview 35 / Drawer 30 when AI open；其余视图按 viewMode 切。
  const gridCols = aiOpen
    ? 'grid-cols-[35fr_35fr_30fr]'
    : viewMode === 'split'
      ? 'grid-cols-2'
      : 'grid-cols-1'
  const showEditor = viewMode !== 'preview-only'
  const showPreview = viewMode !== 'editor-only'

  return (
    <section
      data-page="write"
      className="flex h-[calc(100vh-3.5rem-60px)] flex-col"
    >
      <MainToolbar
        title={draft.title}
        category={draft.category}
        onTitleChange={onTitleChange}
        onCategoryChange={onCategoryChange}
        onSave={() => {
          saveDraft()
          toast.success('已保存草稿')
        }}
        onPublish={onPublish}
      />
      <SubToolbar
        tags={draft.tags}
        wordCount={wordCount}
        viewMode={viewMode}
        aiOpen={aiOpen}
        onMarkdownInsert={onMarkdownInsert}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onToggleAi={() => setAiOpen((o) => !o)}
        onSetViewMode={setViewMode}
      />

      <div className={cn('grid min-h-0 flex-1', gridCols)}>
        {showEditor && (
          <div
            ref={(el) => {
              editorScrollRef.current = el?.querySelector('.cm-scroller') ?? el
            }}
            className="min-w-0 border-r border-border"
          >
            <MarkdownEditor
              value={draft.content}
              onChange={onContentChange}
              onSelectionChange={setSelection}
              className="h-full"
            />
          </div>
        )}
        {showPreview && (
          <MarkdownPreview ref={previewScrollRef} content={draft.content} />
        )}
        {aiOpen && (
          <AIDrawer
            isPending={isPending}
            active={active}
            history={history}
            selectedText={selection.text}
            onCompose={compose}
            onAcceptAll={onAcceptAll}
            onReject={clearActive}
            onClose={() => setAiOpen(false)}
            onPickHistory={(id) => {
              const found = history.find((h) => h.id === id)
              if (found) setActive(found)
            }}
          />
        )}
      </div>

      <FloatingToolbar
        position={
          selection.text.length >= FLOAT_THRESHOLD && selection.rect
            ? { x: selection.rect.x, y: Math.max(0, selection.rect.y - 44) }
            : null
        }
        onPick={(mode) => {
          setAiOpen(true)
          compose(mode, selection.text)
        }}
      />
    </section>
  )
}
