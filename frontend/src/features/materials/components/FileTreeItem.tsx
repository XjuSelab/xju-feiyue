import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, Download, Pencil, Trash2, UploadCloud } from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { FileTypeIcon } from '@/components/common/FileTypeIcon'
import { cn } from '@/lib/cn'

import { INDENT_PX, type FlatNode } from '../lib/tree'

/** 落点指示线挂载边：行顶(before) / 行底(after) / 行内首子位置(inside)。 */
export type DropLineEdge = 'top' | 'bottom' | 'inside'

/**
 * FileTreeItem —— useSortable 递归（扁平）节点行。
 *
 * 设计（角色清单 + plan-materials-integration.md「前端」）：
 * - `role=treeitem` + `aria-expanded`（文件夹）+ `aria-level`；展开/收起 Chevron。
 * - `depth * INDENT_PX` 缩进（与 lib/tree.ts projectDrop 的 X 投影对齐）。
 * - ext 图标走共享 FileTypeIcon（文件夹用 folder 模式，open 跟随展开态）。
 * - active 高亮（当前预览文件）。
 * - sortable-tree 投影指示（Notion 蓝 #a5c9f2）：`dropLineEdge` 在行顶/底/内画一条
 *   ~2px 水平线，左缘按 `dropLineDepth * INDENT_PX` 偏移（落点深度）；`isDropParent`
 *   时给整行加淡蓝高亮（成为该文件夹首子）。投影由 FileTree 下传。
 * - 右键 ui/context-menu：文件 = 下载/重命名/删除；文件夹 = 上传到此/重命名/删除。
 *   仅 owner 渲染写操作项（下载对所有人可见）。菜单项 onSelect 即键盘等效（Radix 自带）。
 * - 文件夹 hover 浮现 UploadCloud 快捷上传按钮。
 * - 仅 owner 启用拖拽（attributes/listeners 条件下挂）。
 */

type Props = {
  node: FlatNode
  /** 树深度（aria-level = depth + 1）。 */
  /** 当前是否被选中预览（active 高亮）。 */
  active: boolean
  /** 文件夹是否展开（驱动 chevron / aria-expanded）。 */
  expanded: boolean
  /** owner 才可写（拖拽 / 重命名 / 删除 / 上传 / 建夹）。 */
  canWrite: boolean
  /** 是否正被拖拽（半透明）。 */
  isDragging: boolean
  /** 落点指示线挂载边（本行承载时非 null）：top=before / bottom=after / inside=首子。 */
  dropLineEdge: DropLineEdge | null
  /** 指示线缩进深度（projectedDepth），左缘 = depth * INDENT_PX。 */
  dropLineDepth: number
  /** 本行是否为投影新父文件夹（成为其首/唯一子时整行淡蓝高亮）。 */
  isDropParent: boolean
  onToggle: (id: string) => void
  onPreview: (node: FlatNode) => void
  onDownload: (node: FlatNode) => void
  onRename: (node: FlatNode) => void
  onDelete: (node: FlatNode) => void
  onUpload: (folderId: string) => void
}

export function FileTreeItem({
  node,
  active,
  expanded,
  canWrite,
  isDragging,
  dropLineEdge,
  dropLineDepth,
  isDropParent,
  onToggle,
  onPreview,
  onDownload,
  onRename,
  onDelete,
  onUpload,
}: Props) {
  const sortable = useSortable({ id: node.id, disabled: !canWrite })
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging: dndDragging,
  } = sortable

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition ?? undefined,
    paddingLeft: node.depth * INDENT_PX + 8,
  }

  const onRowClick = () => {
    if (node.isFolder) onToggle(node.id)
    else onPreview(node)
  }

  const onRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick()
    } else if (node.isFolder && e.key === 'ArrowRight' && !expanded) {
      e.preventDefault()
      onToggle(node.id)
    } else if (node.isFolder && e.key === 'ArrowLeft' && expanded) {
      e.preventDefault()
      onToggle(node.id)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          // 先铺 dnd-kit attributes/listeners（含其默认 role=button/tabIndex），
          // 再用下方显式 role=treeitem / tabIndex 覆盖，保证树语义生效。
          {...(canWrite ? attributes : {})}
          {...(canWrite ? listeners : {})}
          role="treeitem"
          aria-level={node.depth + 1}
          aria-selected={active}
          {...(node.isFolder ? { 'aria-expanded': expanded } : {})}
          tabIndex={0}
          onClick={onRowClick}
          onKeyDown={onRowKeyDown}
          className={cn(
            'group/item relative flex h-8 select-none items-center gap-1.5 pr-2 text-sm',
            'cursor-pointer rounded-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            active ? 'bg-tag-kaggle/60 text-text' : 'text-text-muted hover:bg-bg-hover',
            (isDragging || dndDragging) && 'opacity-40',
            // 投影新父文件夹：整行 Notion 蓝淡高亮 + 细环，提示「成为其子节点」。
            isDropParent && 'bg-[#a5c9f2]/25 ring-1 ring-inset ring-[#a5c9f2]',
          )}
          data-filetree-item=""
        >
          {/* sortable-tree 投影指示线（Notion 蓝 #a5c9f2，2px），缩进对齐落点深度。 */}
          {dropLineEdge ? <DropLine edge={dropLineEdge} depth={dropLineDepth} /> : null}

          {/* 展开箭头（仅文件夹有子节点时旋转，文件占位对齐）。 */}
          {node.isFolder ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                onToggle(node.id)
              }}
              aria-hidden
              className="flex size-4 shrink-0 items-center justify-center text-text-faint"
            >
              {node.hasChildren ? (
                <ChevronRight
                  className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
                />
              ) : null}
            </button>
          ) : (
            <span aria-hidden className="size-4 shrink-0" />
          )}

          {/* 类型图标 */}
          {node.isFolder ? (
            <FileTypeIcon folder open={expanded} size={16} className="size-4 shrink-0" />
          ) : (
            <FileTypeIcon ext={node.ext ?? ''} size={16} className="size-4 shrink-0" />
          )}

          {/* 名称 */}
          <span className="min-w-0 flex-1 truncate" title={node.name}>
            {node.name}
          </span>

          {/* 文件体积（文件才有） */}
          {!node.isFolder && node.size ? (
            <span className="shrink-0 text-xs tabular-nums text-text-faint opacity-0 transition-opacity group-hover/item:opacity-100">
              {node.size}
            </span>
          ) : null}

          {/* 文件夹 hover：快捷上传按钮（仅 owner）。 */}
          {node.isFolder && canWrite ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                onUpload(node.id)
              }}
              aria-label={`上传到「${node.name}」`}
              title="上传到此文件夹"
              className="flex size-6 shrink-0 items-center justify-center rounded-sm text-text-faint opacity-0 transition-opacity hover:bg-border hover:text-text group-hover/item:opacity-100"
            >
              <UploadCloud className="size-3.5" />
            </button>
          ) : null}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="min-w-[10rem]">
        {node.isFolder ? (
          <>
            {canWrite ? (
              <ContextMenuItem onSelect={() => onUpload(node.id)} className="gap-2">
                <UploadCloud className="size-4" />
                上传到此文件夹
              </ContextMenuItem>
            ) : null}
          </>
        ) : (
          <ContextMenuItem onSelect={() => onDownload(node)} className="gap-2">
            <Download className="size-4" />
            下载
          </ContextMenuItem>
        )}

        {canWrite ? (
          <>
            <ContextMenuItem onSelect={() => onRename(node)} className="gap-2">
              <Pencil className="size-4" />
              重命名
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onDelete(node)}
              className="gap-2 text-cat-research focus:text-cat-research"
            >
              <Trash2 className="size-4" />
              删除
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * sortable-tree 投影指示线（Notion 蓝 #a5c9f2，2px）。
 * - `edge`：top=before(行顶) / bottom=after(行底) / inside=该文件夹首子位置(行底)。
 * - `depth`：projectedDepth，左缘 = depth * INDENT_PX + 8（与行 paddingLeft 对齐），
 *   带一个小圆点锚点，呈 Notion/Outliner 缩进指示风格。
 */
function DropLine({ edge, depth }: { edge: DropLineEdge; depth: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute right-1 z-10 flex h-[2px] items-center',
        // inside 与 after 同样画在行底（成为该夹首子，视觉落在其下沿）。
        edge === 'top' ? '-top-px' : '-bottom-px',
      )}
      style={{ left: depth * INDENT_PX + 8 }}
    >
      <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#a5c9f2]" />
      <span className="h-[2px] flex-1 rounded-full bg-[#a5c9f2]" />
    </span>
  )
}
