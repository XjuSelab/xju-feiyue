import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import type { EditorView } from '@codemirror/view'
import { ApiError } from '@/api/client'
import * as draftsApi from '@/api/endpoints/drafts'
import * as notesApi from '@/api/endpoints/notes'
import { useAuthStore } from '@/stores/authStore'
import { useDraftStore, type Draft } from '@/stores/draftStore'
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
  const { draftId, noteId } = useParams<{ draftId?: string; noteId?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEditMode = !!noteId

  const drafts = useDraftStore((s) => s.drafts)
  const currentId = useDraftStore((s) => s.currentId)
  const ensureCurrent = useDraftStore((s) => s.ensureCurrent)
  const loadDraft = useDraftStore((s) => s.loadDraft)
  const updateDraft = useDraftStore((s) => s.updateDraft)
  const saveDraft = useDraftStore((s) => s.saveDraft)
  const deleteDraft = useDraftStore((s) => s.deleteDraft)

  // Edit mode keeps its draft entirely in local state so it doesn't pollute
  // the persisted drafts list. Initial values come from the published note.
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const storeDraft = currentId ? (drafts[currentId] ?? null) : null
  const draft = isEditMode ? editingDraft : storeDraft

  const authMode = useAuthStore((s) => s.mode)
  const [publishing, setPublishing] = useState(false)
  const editorViewRef = useRef<EditorView | null>(null)

  // Initial load: edit mode hydrates from API; otherwise route param > existing > new.
  useEffect(() => {
    if (isEditMode && noteId) {
      let cancelled = false
      notesApi
        .getNote(noteId)
        .then((note) => {
          if (cancelled) return
          setEditingDraft({
            id: `edit_${note.id}`,
            title: note.title,
            content: note.content,
            category: note.category,
            tags: note.tags,
            updatedAt: new Date().toISOString(),
          })
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setEditError(e instanceof Error ? e.message : '加载笔记失败')
        })
      return () => {
        cancelled = true
      }
    }
    if (draftId) {
      loadDraft(draftId)
    } else if (!currentId) {
      ensureCurrent()
    }
    return undefined
  }, [isEditMode, noteId, draftId, currentId, loadDraft, ensureCurrent])

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

  const { compose, isPending, active, history, setActive, clearActive } = useAICompose()

  // Autosave: only meaningful for new drafts. Edit mode persists on Publish.
  useAutoSave(
    [draft?.title, draft?.content, draft?.category, draft?.tags?.join(',')],
    isEditMode ? () => {} : saveDraft,
  )

  const wordCount = useMemo(
    () => (draft?.content ?? '').replace(/\s+/g, '').length,
    [draft?.content],
  )

  if (isEditMode && editError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        加载失败：{editError}
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        {isEditMode ? '正在加载笔记…' : '正在准备草稿…'}
      </div>
    )
  }

  // Unified write-through that picks the right backing store.
  const updateField = (patch: Partial<Omit<Draft, 'id' | 'updatedAt'>>) => {
    if (isEditMode) {
      setEditingDraft((d) => (d ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d))
    } else {
      updateDraft(patch)
    }
  }

  const onContentChange = (v: string) => updateField({ content: v })
  const onTitleChange = (v: string) => updateField({ title: v })
  const onCategoryChange = (c: CategoryId) => updateField({ category: c })
  const onAddTag = (tag: string) => updateField({ tags: [...draft.tags, tag] })
  const onRemoveTag = (tag: string) => updateField({ tags: draft.tags.filter((t) => t !== tag) })

  // Insert markdown via CodeMirror — `$` in the snippet is the caret marker:
  // wraps the current selection if any, otherwise places the cursor where
  // `$` was (e.g. `**$**` → cursor between the asterisks).
  const onMarkdownInsert = (snippet: string) => {
    const view = editorViewRef.current
    const markerIdx = snippet.indexOf('$')
    const before = markerIdx >= 0 ? snippet.slice(0, markerIdx) : snippet
    const after = markerIdx >= 0 ? snippet.slice(markerIdx + 1) : ''

    if (!view) {
      // Fallback: append to end (no editor yet). Drops the marker.
      onContentChange(`${draft.content}${before}${after}`)
      return
    }
    const sel = view.state.selection.main
    const selected = view.state.doc.sliceString(sel.from, sel.to)
    const insertText = `${before}${selected}${after}`
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: insertText },
      selection: {
        anchor: sel.from + before.length,
        head: sel.from + before.length + selected.length,
      },
    })
    view.focus()
  }

  const onAcceptAll = () => {
    if (!active) return
    if (selection.from !== selection.to) {
      const next =
        draft.content.slice(0, selection.from) + active.after + draft.content.slice(selection.to)
      onContentChange(next)
    } else {
      onContentChange(active.after)
    }
    toast.success('已应用 AI 修改')
    clearActive()
  }

  const onPublish = async () => {
    if (publishing || !draft) return

    const title = draft.title.trim()
    const content = draft.content.trim()
    if (!title) {
      toast.error(isEditMode ? '标题不能为空' : '发布前请先填写标题')
      return
    }
    if (!content) {
      toast.error(isEditMode ? '正文不能为空' : '发布前请先填写正文')
      return
    }
    if (!draft.category) {
      toast.error(isEditMode ? '请先选择分类' : '发布前请先选择分类')
      return
    }
    if (authMode !== 'authed') {
      toast.error('请先登录')
      return
    }

    setPublishing(true)
    try {
      if (isEditMode && noteId) {
        await notesApi.updateNote(noteId, {
          title: draft.title,
          content: draft.content,
          category: draft.category,
          tags: draft.tags,
        })
        toast.success('修改已保存')
        void qc.invalidateQueries({ queryKey: ['note', noteId] })
        void qc.invalidateQueries({ queryKey: ['notes'] })
        navigate(`/note/${noteId}`)
      } else {
        const server = await draftsApi.createDraft({
          title: draft.title,
          content: draft.content,
          category: draft.category,
          tags: draft.tags,
        })
        const note = await draftsApi.publishDraft(server.id)
        deleteDraft(draft.id)
        toast.success('发布成功')
        navigate(`/note/${note.id}`)
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '保存失败，请稍后再试'
      toast.error(msg)
    } finally {
      setPublishing(false)
    }
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
    <section data-page="write" className="flex h-[calc(100vh-3.5rem-60px)] flex-col">
      <MainToolbar
        title={draft.title}
        category={draft.category}
        onTitleChange={onTitleChange}
        onCategoryChange={onCategoryChange}
        onSave={() => {
          if (isEditMode) {
            toast.info('点击「保存修改」提交更改')
            return
          }
          saveDraft()
          toast.success('已保存草稿')
        }}
        onPublish={onPublish}
        publishing={publishing}
        mode={isEditMode ? 'edit' : 'new'}
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
              onReady={(v) => {
                editorViewRef.current = v
              }}
              className="h-full"
            />
          </div>
        )}
        {showPreview && <MarkdownPreview ref={previewScrollRef} content={draft.content} />}
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
