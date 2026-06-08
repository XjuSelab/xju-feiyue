import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelGroupHandle,
} from 'react-resizable-panels'
import type { EditorView } from '@codemirror/view'
import { ApiError } from '@/api/client'
import * as draftsApi from '@/api/endpoints/drafts'
import * as notesApi from '@/api/endpoints/notes'
import * as uploadsApi from '@/api/endpoints/uploads'
import { useAuthStore } from '@/stores/authStore'
import { useDraftStore, type Draft } from '@/stores/draftStore'
import type { CategoryId } from '@/lib/categories'
import {
  DOC_EXTS,
  MAX_UPLOAD_BYTES,
  formatBytes,
  isDocFile,
  isImageFile,
} from '@/lib/fileTypes'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { MainToolbar } from './toolbar/MainToolbar'
import { SubToolbar, type EditorViewMode } from './toolbar/SubToolbar'
import { AIDrawer } from './ai/AIDrawer'
import { FloatingToolbar } from './ai/FloatingToolbar'
import { useAICompose } from './ai/useAICompose'
import { SummaryField } from './SummaryField'
import { useAutoSave } from './hooks/useAutoSave'
import { useScrollSync } from './hooks/useScrollSync'

const FLOAT_THRESHOLD = 4

// File-picker `accept`: doc extensions (Windows often reports empty MIME, so
// extensions are the authority) plus canonical MIME hints for nicer dialogs.
const DOC_ACCEPT = [
  ...DOC_EXTS,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',')

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const docInputRef = useRef<HTMLInputElement | null>(null)
  // Drag-over overlay: dragenter/dragleave fire on every child element, so a
  // bare boolean flickers. Count enters minus leaves; overlay shows when > 0.
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

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
            summary: note.summary,
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
  const panelGroupRef = useRef<ImperativePanelGroupHandle | null>(null)
  useScrollSync(editorScrollRef, previewScrollRef, viewMode === 'split')

  const { compose, isPending, active, history, setActive, clearActive } = useAICompose()

  // Autosave: only meaningful for new drafts. Edit mode persists on Publish.
  useAutoSave(
    [draft?.title, draft?.summary, draft?.content, draft?.category, draft?.tags?.join(',')],
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

  // 链接按钮。光标默认停在 `[]` 里（用户要求：填可见文字优先，而不是落在 `()` 的
  // 网址占位里）。不再塞 `url` / `https://` 占位词——忘了替换会渲染成跳 404 的死链；
  // 留空的 `()` 由 Markdown 渲染层兜底成纯文本（见 components/common/Markdown.tsx）。
  //   - 选区是网址 → `[](网址)`，光标回 `[]` 填可见文字
  //   - 选区是普通文字 → `[文字]()`，光标落在 `()` 填网址（文字已就位，这是例外）
  //   - 无选区 → `[]()`，光标停在 `[]` 中间
  const onInsertLink = () => {
    const view = editorViewRef.current
    if (!view) {
      onContentChange(`${draft.content}[]()`)
      return
    }
    const sel = view.state.selection.main
    const selected = view.state.doc.sliceString(sel.from, sel.to)
    const looksLikeUrl = /^https?:\/\/\S+$/i.test(selected.trim())
    let insertText: string
    let anchor: number
    if (looksLikeUrl) {
      insertText = `[](${selected.trim()})`
      anchor = sel.from + 1
    } else if (selected) {
      insertText = `[${selected}]()`
      anchor = sel.from + 1 + selected.length + 2
    } else {
      insertText = `[]()`
      anchor = sel.from + 1
    }
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: insertText },
      selection: { anchor },
    })
    view.focus()
  }

  // Insert plain text at the current caret (or end-of-doc fallback) and leave
  // the caret right after the inserted text. Used for sequential multi-file
  // uploads: each insert reads the live selection and chains the caret forward,
  // so awaiting between files never inserts at a stale offset (plan §6).
  const insertAtCursor = (text: string) => {
    const view = editorViewRef.current
    if (!view) {
      onContentChange(`${draft.content}${text}`)
      return
    }
    const sel = view.state.selection.main
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: text },
      selection: { anchor: sel.from + text.length },
    })
    view.focus()
  }

  // Upload a single file (image → ![](url); doc → [name](url)) and insert it
  // at the caret. Returns true on success. Size guard mirrors backend
  // MAX_UPLOAD_BYTES so oversized files fail fast without a round-trip.
  //
  // `toastId` (when given) is the shared loading toast from uploadAndInsert: the
  // doc branch uploads via XHR with real byte progress and updates that one
  // toast in place (`文件上传中… NN%` → 服务器接收中…), so the user sees movement on
  // big attachments. Images stay one-shot (small, mock URL in dev anyway).
  const uploadOne = async (file: File, toastId?: string | number): Promise<boolean> => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`「${file.name}」超过 ${formatBytes(MAX_UPLOAD_BYTES)} 上限`)
      return false
    }
    try {
      if (isImageFile(file)) {
        const { url } = await uploadsApi.uploadNoteImage(file)
        insertAtCursor(`![](${url})`)
      } else {
        const { url, filename } = await uploadsApi.uploadNoteFile(file, (p) => {
          if (toastId === undefined) return
          // 字节发完（100%）后进入 processing：数据正经 CF 隧道传到源站、服务器接收/落盘，
          // 仍需时间。文案改「服务器接收中…」而非满进度的「处理中…」，更诚实。
          if (p.phase === 'processing' || p.phase === 'done') {
            toast.loading('服务器接收中…', { id: toastId })
          } else if (p.ratio != null) {
            toast.loading(`文件上传中… ${Math.round(p.ratio * 100)}%`, { id: toastId })
          }
        })
        // 前导/尾随换行让附件 [name](url) 自成一段 → 渲染为块级 FileCard。
        insertAtCursor(`\n[${filename}](${url})\n`)
      }
      return true
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : `「${file.name}」上传失败`
      toast.error(msg)
      return false
    }
  }

  // Upload a batch sequentially (single loading toast, one summary toast — no
  // concurrent-toast spam). A failed file is reported but does not abort the
  // rest of the batch.
  const uploadAndInsert = async (files: File[]) => {
    if (authMode !== 'authed') {
      toast.error('请先登录再上传')
      return
    }
    const accepted = files.filter((f) => isImageFile(f) || isDocFile(f))
    if (accepted.length === 0) return

    const t = toast.loading(accepted.length > 1 ? `上传中… (0/${accepted.length})` : '上传中…')
    let ok = 0
    for (let i = 0; i < accepted.length; i += 1) {
      const file = accepted[i]
      if (!file) continue
      if (accepted.length > 1) {
        toast.loading(`上传中… (${i}/${accepted.length})`, { id: t })
      }
      // 单文件时把共享 toast 交给 uploadOne 的 doc 分支逐字节更新百分比；多文件
      // 时外层已显示 (i/n) 计数，doc 分支内仍会在每个文件内刷新「…NN% / 处理中…」。
      if (await uploadOne(file, t)) ok += 1
    }
    if (ok === accepted.length) {
      toast.success(ok > 1 ? `已插入 ${ok} 个文件` : '已插入', { id: t })
    } else if (ok > 0) {
      toast.warning(`已插入 ${ok}/${accepted.length} 个文件`, { id: t })
    } else {
      toast.error('上传失败', { id: t })
    }
  }

  const onPickImage = () => fileInputRef.current?.click()
  const onPickFile = () => docInputRef.current?.click()

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
          summary: draft.summary,
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
          summary: draft.summary,
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

  const showEditor = viewMode !== 'preview-only'
  const showPreview = viewMode !== 'editor-only'
  // Distinct autoSaveId per layout combination so each one keeps its own
  // splitter position in localStorage (otherwise toggling viewMode/aiOpen
  // would overwrite the size with a layout that has a different panel count).
  const layoutKey = `write-${viewMode}-${aiOpen ? 'ai' : 'noai'}`

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
        onInsertLink={onInsertLink}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onToggleAi={() => setAiOpen((o) => !o)}
        onSetViewMode={setViewMode}
        onResetLayout={() => {
          // Distribute evenly across however many panels are currently mounted
          // (2 for split, 3 when the AI drawer is open).
          const panelCount = aiOpen ? 3 : 2
          const even = Number((100 / panelCount).toFixed(2))
          const layout = Array.from({ length: panelCount }, (_, i) =>
            i === panelCount - 1 ? 100 - even * (panelCount - 1) : even,
          )
          panelGroupRef.current?.setLayout(layout)
        }}
        canPolish={selection.text.trim().length >= FLOAT_THRESHOLD}
        onPolish={() => {
          setAiOpen(true)
          compose('polish', selection.text)
        }}
        onPickImage={onPickImage}
        onPickFile={onPickFile}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void uploadAndInsert([f])
          // Reset so re-selecting the same file fires onChange again.
          e.target.value = ''
        }}
      />

      <input
        ref={docInputRef}
        type="file"
        multiple
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) void uploadAndInsert(files)
          e.target.value = ''
        }}
      />

      <div className="border-b border-border bg-bg px-6 py-2">
        <SummaryField
          value={draft.summary}
          onChange={(v) => updateField({ summary: v })}
          content={draft.content}
          title={draft.title}
        />
      </div>

      <PanelGroup
        key={layoutKey}
        ref={panelGroupRef}
        direction="horizontal"
        autoSaveId={layoutKey}
        className="min-h-0 flex-1"
      >
        {showEditor && (
          <Panel defaultSize={showPreview ? (aiOpen ? 35 : 50) : 70} minSize={20}>
            <div
              ref={(el) => {
                editorScrollRef.current = el?.querySelector('.cm-scroller') ?? el
              }}
              className="relative h-full min-w-0 border-r border-border"
              onDragEnter={(e) => {
                if (!Array.from(e.dataTransfer.types).includes('Files')) return
                dragCounter.current += 1
                setIsDragging(true)
              }}
              onDragOver={(e) => {
                // Required so the drop event fires (also shows the copy cursor).
                if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault()
              }}
              onDragLeave={() => {
                dragCounter.current = Math.max(0, dragCounter.current - 1)
                if (dragCounter.current === 0) setIsDragging(false)
              }}
              onDrop={(e) => {
                dragCounter.current = 0
                setIsDragging(false)
                // CodeMirror's own drop handler already handled (and uploaded)
                // files dropped onto the text area — it calls preventDefault, so
                // we only take over drops onto the padding / empty area here.
                if (e.defaultPrevented) return
                const files = Array.from(e.dataTransfer.files).filter(
                  (f) => isImageFile(f) || isDocFile(f),
                )
                if (files.length) {
                  e.preventDefault()
                  void uploadAndInsert(files)
                }
              }}
            >
              <MarkdownEditor
                value={draft.content}
                onChange={onContentChange}
                onSelectionChange={setSelection}
                onReady={(v) => {
                  editorViewRef.current = v
                }}
                onPasteFiles={(files) => {
                  void uploadAndInsert(files)
                }}
                onDropFiles={(files) => {
                  void uploadAndInsert(files)
                }}
                className="h-full"
              />
              {isDragging && (
                <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-cat-kaggle bg-tag-kaggle/60 text-sm font-medium text-cat-kaggle">
                  松开以上传图片或附件
                </div>
              )}
            </div>
          </Panel>
        )}
        {showEditor && showPreview && (
          <PanelResizeHandle className="w-1 bg-border transition hover:bg-border-strong" />
        )}
        {showPreview && (
          <Panel defaultSize={showEditor ? (aiOpen ? 35 : 50) : 70} minSize={20}>
            <MarkdownPreview ref={previewScrollRef} content={draft.content} className="h-full" />
          </Panel>
        )}
        {aiOpen && (
          <>
            <PanelResizeHandle className="w-1 bg-border transition hover:bg-border-strong" />
            <Panel defaultSize={30} minSize={20} maxSize={50}>
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
            </Panel>
          </>
        )}
      </PanelGroup>

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
