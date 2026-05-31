import * as React from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  MeasuringStrategy,
  useSensor,
  useSensors,
  type Announcements,
  type DragMoveEvent,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/common/EmptyState'
import { cn } from '@/lib/cn'

import {
  flattenTree,
  projectDrop,
  type DropProjection,
  type FlatNode,
} from '../lib/tree'
import { EMPTY_FILES } from '../data'
import type { MaterialFile, ReorderInput, ReorderPosition } from '../types'
import { FileTreeItem } from './FileTreeItem'

/**
 * FileTree —— 详情 split-pane 左栏的递归文件夹树（dnd-kit headless）。
 *
 * 设计（角色清单 + plan-materials-integration.md「前端」）：
 * - 递归树 → `flattenTree`（折叠子树整段排除）→ `SortableContext`(verticalListSortingStrategy)。
 * - 拖拽（sortable-tree 投影）：`onDragMove`/`onDragOver` 把 over.id + 水平位移
 *   `event.delta.x` 喂 `projectDrop`，得 {depth, parentId, dropId, position}。一套投影
 *   统一处理 进/出/重排（向右拖=进入上方文件夹、向左拖=退出更外层、纯上下=同级重排）。
 *   投影经 FileTreeItem 画 Notion 蓝（#a5c9f2）水平指示线（缩进按 projectedDepth），
 *   成为某文件夹首子时给该文件夹整行淡蓝高亮。`onDragEnd` 翻成 reorder API。
 * - sensors：PointerSensor（拖前阈值避免误触）+ KeyboardSensor（sortableKeyboardCoordinates）；
 *   `announcements` aria-live 播报拖拽进度（a11y）。
 * - `role=tree` 容器；空态 / 空夹虚线上传（仅 owner）。
 * - 仅 owner 可拖拽（FileTreeItem 内 useSortable disabled）。
 */

type Props = {
  files: MaterialFile[]
  /** 当前预览文件 id（active 高亮）。 */
  activeFileId: string | null
  /** owner 才可写（拖拽 / 重命名 / 删除 / 上传）。 */
  canWrite: boolean
  onPreview: (target: FlatNode) => void
  onReorder: (input: ReorderInput) => void
  onDownload: (node: FlatNode) => void
  onRename: (node: FlatNode) => void
  onDelete: (node: FlatNode) => void
  /** 上传到指定文件夹（folderId）或资源根（''）。 */
  onUpload: (folderId: string) => void
  className?: string
}

export function FileTree({
  files,
  activeFileId,
  canWrite,
  onPreview,
  onReorder,
  onDownload,
  onRename,
  onDelete,
  onUpload,
  className,
}: Props) {
  // 折叠的文件夹 id 集合（默认全展开：collapsed 为空）。
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set())
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null)
  const [projection, setProjection] = React.useState<DropProjection>(null)

  const flat = React.useMemo(() => flattenTree(files, collapsed), [files, collapsed])
  const ids = React.useMemo(() => flat.map((f) => f.id), [flat])
  const flatById = React.useMemo(() => new Map(flat.map((f) => [f.id, f])), [flat])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const toggle = React.useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // 拖拽开始：记录拖拽节点，并先折叠它（避免拖一个文件夹时 over 自身子树抖动）。
  const onDragStart = React.useCallback((e: DragStartEvent) => {
    const id = String(e.active.id)
    setActiveDragId(id)
    setProjection(null)
    setCollapsed((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const onDragMove = React.useCallback(
    (e: DragMoveEvent) => {
      const { active, over, delta } = e
      if (!over) {
        setProjection(null)
        return
      }
      // sortable-tree 投影：纵向落点(over.id) 定插入行，水平位移(delta.x) 定意图深度。
      setProjection(
        projectDrop({
          dragId: String(active.id),
          overId: String(over.id),
          offsetX: delta.x,
          flat,
        }),
      )
    },
    [flat],
  )

  const finish = React.useCallback(() => {
    setActiveDragId(null)
    setProjection(null)
  }, [])

  const onDragEnd = React.useCallback(
    (e: DragEndEvent) => {
      const dragId = String(e.active.id)
      const proj = projection
      finish()
      if (!proj) return
      if (proj.dropId === dragId) return
      onReorder({ dragId, dropId: proj.dropId, position: proj.position })
    },
    [projection, finish, onReorder],
  )

  // aria-live 播报（a11y）。
  const announcements = React.useMemo<Announcements>(
    () => ({
      onDragStart({ active }) {
        const n = flatById.get(String(active.id))
        return `已拿起${n?.isFolder ? '文件夹' : '文件'}「${n?.name ?? active.id}」。`
      },
      onDragOver({ active, over }) {
        if (!over) return undefined
        const a = flatById.get(String(active.id))
        const o = flatById.get(String(over.id))
        const pos = projectionLabel(projection?.position)
        return `「${a?.name ?? active.id}」移动到「${o?.name ?? over.id}」${pos}。`
      },
      onDragEnd({ active, over }) {
        const a = flatById.get(String(active.id))
        if (!over || !projection) return `已取消移动「${a?.name ?? active.id}」。`
        const o = flatById.get(String(projection.dropId))
        return `已将「${a?.name ?? active.id}」放到「${o?.name ?? projection.dropId}」${projectionLabel(projection.position)}。`
      },
      onDragCancel({ active }) {
        const a = flatById.get(String(active.id))
        return `已取消移动「${a?.name ?? active.id}」。`
      },
    }),
    [flatById, projection],
  )

  // 空态（无文件）：虚线上传（仅 owner）/ 纯空态。
  if (files.length === 0) {
    return (
      <div className={cn('flex h-full min-h-0 flex-col', className)} role="tree" aria-label="文件树">
        {canWrite ? (
          <button
            type="button"
            onClick={() => onUpload('')}
            className={cn(
              'm-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-bg-subtle px-4 py-8 text-center text-text-muted',
              'transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <EmptyState
              icon={EMPTY_FILES.icon}
              title={EMPTY_FILES.title}
              description="点击上传文件，或在工具栏新建文件夹来组织内容。"
            />
          </button>
        ) : (
          <EmptyState
            icon={EMPTY_FILES.icon}
            title={EMPTY_FILES.title}
            description="这份资料的作者还没有上传任何文件。"
          />
        )}
      </div>
    )
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={finish}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div role="tree" aria-label="文件树" className="py-1.5 pr-1.5">
            {flat.map((node) => {
              // 该行是否承载落点指示线（before/after）。inside 落点的指示线由父
              // 文件夹行承载（line=该夹首子位置），同时父行整行高亮。
              const lineEdge =
                projection && projection.dropId === node.id && node.id !== activeDragId
                  ? projection.position === 'before'
                    ? 'top'
                    : projection.position === 'after'
                      ? 'bottom'
                      : 'inside'
                  : null
              // 该行是否为投影的新父文件夹（成为其首/唯一子时整行淡蓝高亮）。
              const isDropParent =
                projection != null &&
                projection.parentId === node.id &&
                node.id !== activeDragId
              return (
                <FileTreeItem
                  key={node.id}
                  node={node}
                  active={!node.isFolder && node.id === activeFileId}
                  expanded={!collapsed.has(node.id)}
                  canWrite={canWrite}
                  isDragging={node.id === activeDragId}
                  dropLineEdge={lineEdge}
                  dropLineDepth={projection?.depth ?? node.depth}
                  isDropParent={isDropParent}
                  onToggle={toggle}
                  onPreview={onPreview}
                  onDownload={onDownload}
                  onRename={onRename}
                  onDelete={onDelete}
                  onUpload={onUpload}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </ScrollArea>
  )
}

/** position → 中文播报后缀。 */
function projectionLabel(pos: ReorderPosition | undefined): string {
  switch (pos) {
    case 'before':
      return '的前面'
    case 'after':
      return '的后面'
    case 'inside':
      return '的内部'
    default:
      return ''
  }
}
