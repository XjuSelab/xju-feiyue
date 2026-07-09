import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { FolderPlus, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  ApiError,
  useAddCollectionEntry,
  useCollectionDetail,
  useCreateCollection,
  useDeleteCollection,
  useMyCollections,
  useMyNotes,
  useRemoveCollectionEntry,
  useReorderCollectionEntries,
  useUpdateCollection,
  type Collection,
  type CollectionNote,
} from '@/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'
import { SortableEntry } from './SortableEntry'

const inputCls =
  'w-full rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none focus-visible:ring-1 focus-visible:ring-border-strong'

export function CollectionsTab() {
  const collectionsQ = useMyCollections(true)
  const collections = useMemo(() => collectionsQ.data ?? [], [collectionsQ.data])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedId && collections[0]) setSelectedId(collections[0].id)
  }, [collections, selectedId])

  const detailQ = useCollectionDetail(selectedId)
  const detail = detailQ.data

  const createMut = useCreateCollection()
  const updateMut = useUpdateCollection()
  const deleteMut = useDeleteCollection()
  const addMut = useAddCollectionEntry()
  const removeMut = useRemoveCollectionEntry()
  const reorderMut = useReorderCollectionEntries()

  // Local order for drag; synced from server whenever the detail changes.
  const [items, setItems] = useState<CollectionNote[]>([])
  useEffect(() => {
    setItems(detail?.entries ?? [])
  }, [detail])

  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleting, setDeleting] = useState<Collection | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onCreate = () => {
    const title = newTitle.trim()
    if (!title || createMut.isPending) return
    createMut.mutate(
      { title },
      {
        onSuccess: (c) => {
          setNewTitle('')
          setSelectedId(c.id)
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : '创建失败'),
      },
    )
  }

  const onSaveRename = () => {
    if (!editingId) return
    const title = editTitle.trim()
    if (!title) return
    updateMut.mutate(
      { id: editingId, body: { title } },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : '重命名失败'),
      },
    )
  }

  const onConfirmDelete = () => {
    if (!deleting) return
    const id = deleting.id
    deleteMut.mutate(id, {
      onSuccess: () => {
        setDeleting(null)
        if (selectedId === id) setSelectedId(null)
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : '删除失败'),
    })
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id || !selectedId) return
    const from = items.findIndex((n) => n.id === active.id)
    const to = items.findIndex((n) => n.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(items, from, to)
    setItems(next) // optimistic
    reorderMut.mutate(
      { collectionId: selectedId, noteIds: next.map((n) => n.id) },
      { onError: (err) => toast.error(err instanceof ApiError ? err.message : '排序保存失败') },
    )
  }

  const onRemoveEntry = (noteId: string) => {
    if (!selectedId) return
    setItems((prev) => prev.filter((n) => n.id !== noteId)) // optimistic
    removeMut.mutate(
      { collectionId: selectedId, noteId },
      { onError: (e) => toast.error(e instanceof ApiError ? e.message : '移出失败') },
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      {/* left: collection list + create */}
      <aside className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            className={inputCls}
            placeholder="新建合集名称…"
            value={newTitle}
            maxLength={60}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <Button type="button" size="sm" onClick={onCreate} disabled={createMut.isPending}>
            <Plus size={14} aria-hidden />
          </Button>
        </div>

        {collectionsQ.isLoading && <p className="text-sm text-text-muted">加载合集…</p>}
        {!collectionsQ.isLoading && collections.length === 0 && (
          <p className="text-sm text-text-faint">还没有合集，新建一个把笔记组织成专题吧。</p>
        )}

        <ul className="space-y-1">
          {collections.map((c) => (
            <li key={c.id}>
              {editingId === c.id ? (
                <div className="flex items-center gap-1">
                  <input
                    className={inputCls}
                    value={editTitle}
                    autoFocus
                    maxLength={60}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveRename()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                    selectedId === c.id ? 'bg-bg-subtle text-text' : 'text-text-muted hover:bg-bg-subtle/60',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="min-w-0 flex-1 truncate text-left"
                    title={c.title}
                  >
                    {c.title}
                  </button>
                  <span className="shrink-0 text-xs text-text-faint">{c.entryCount}</span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setEditingId(c.id)
                      setEditTitle(c.title)
                    }}
                    aria-label="重命名"
                    className="shrink-0 text-text-faint opacity-0 hover:text-text-muted group-hover:opacity-100"
                  >
                    <Pencil size={13} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(c)}
                    aria-label="删除合集"
                    className="shrink-0 text-text-faint opacity-0 hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </aside>

      {/* right: selected collection entries */}
      <section className="min-w-0">
        {!selectedId ? (
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-text-faint">
            <Layers size={16} className="mr-2" aria-hidden /> 选择左侧一个合集来管理笔记
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-serif text-lg font-semibold text-text">
                  {detail?.title ?? '…'}
                </h3>
                <p className="text-xs text-text-faint">
                  {items.length} 篇 · 拖动 <span className="align-middle">⠿</span> 调整顺序
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                <FolderPlus size={14} aria-hidden /> 添加笔记
              </Button>
            </div>

            {detailQ.isLoading && <p className="text-sm text-text-muted">加载合集内容…</p>}
            {!detailQ.isLoading && items.length === 0 && (
              <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-faint">
                合集是空的，点「添加笔记」把你的已发布笔记加进来。
              </p>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={items.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {items.map((n, i) => (
                    <SortableEntry
                      key={n.id}
                      note={n}
                      index={i}
                      onRemove={() => onRemoveEntry(n.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </section>

      {/* delete-collection confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !deleteMut.isPending && !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除合集「{deleting?.title}」？</DialogTitle>
            <DialogDescription>
              仅删除合集本身，合集内的笔记不会被删除。此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deleteMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={onConfirmDelete}
              disabled={deleteMut.isPending}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deleteMut.isPending ? '删除中…' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* add-notes picker */}
      <AddNotesDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={items.map((n) => n.id)}
        pending={addMut.isPending}
        onAdd={(noteId) => {
          if (!selectedId) return
          addMut.mutate(
            { collectionId: selectedId, noteId },
            {
              onError: (e) => toast.error(e instanceof ApiError ? e.message : '加入失败'),
            },
          )
        }}
      />
    </div>
  )
}

function AddNotesDialog({
  open,
  onOpenChange,
  excludeIds,
  pending,
  onAdd,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  excludeIds: string[]
  pending: boolean
  onAdd: (noteId: string) => void
}) {
  const notesQ = useMyNotes(open)
  const published = notesQ.data?.pages.flatMap((p) => p.items) ?? []
  const exclude = new Set(excludeIds)
  const candidates = published.filter((n) => !exclude.has(n.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加笔记到合集</DialogTitle>
          <DialogDescription>
            只能加入你自己的已发布笔记；单篇笔记至多属于一个合集。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {notesQ.isLoading && <p className="text-sm text-text-muted">加载笔记…</p>}
          {!notesQ.isLoading && candidates.length === 0 && (
            <p className="py-6 text-center text-sm text-text-faint">没有可添加的已发布笔记。</p>
          )}
          {candidates.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-bg-subtle/60"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-text">{n.title}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onAdd(n.id)}
              >
                加入
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
