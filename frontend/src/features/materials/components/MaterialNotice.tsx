import * as React from 'react'
import { Check, Heart, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/cn'

import { useDeleteNotice, useNotice, useUpdateNotice } from '../hooks/useMaterials'

/**
 * 资料列表页顶部的「致谢信息条」—— Notion 风格小字长条。
 *
 * 语义：
 * - 共享读：`visible` 时所有人可见；内容里的 http(s) 链接渲染为可点击。
 * - 管理员（`user.isAdmin`）可**编辑内容**（内联 Textarea）与**删除/隐藏**（软隐藏，
 *   内容保留）；隐藏后管理员看到一个低调的「添加致谢信息」入口可恢复。
 * - 普通用户在隐藏态什么都不渲染；加载中/出错也不渲染，避免布局抖动。
 *
 * toast 在 hook 层（useUpdateNotice / useDeleteNotice），不在渲染期调用
 * （MEMORY：sonner 对 strict-mode + HMR 敏感）。
 */

/** 隐藏态下，管理员点「添加」时预填的默认文案（与后端迁移 seed 对齐）。 */
const DEFAULT_CONTENT =
  '📚 本页部分课程资料整理自开源仓库 ' +
  'https://github.com/XJU-OpenHub/XjuCsMajorResources ，由黄耀增学长贡献，特此致谢 🙏'

const URL_RE = /(https?:\/\/[^\s，。、）)]+)/g

/** github.com/owner/repo → "owner/repo"；其它 → host+path；非法 URL 原样返回。 */
function linkLabel(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/^\/+|\/+$/g, '')
    if (u.hostname === 'github.com' && path) return path
    return `${u.hostname}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    return url
  }
}

/** 把纯文本里的裸链接渲染成可点击 <a>，其余原样。 */
function renderContent(text: string): React.ReactNode[] {
  return text.split(URL_RE).map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-cat-course underline decoration-cat-course/40 underline-offset-2 transition-colors hover:decoration-cat-course"
          onClick={(e) => e.stopPropagation()}
        >
          {linkLabel(part)}
        </a>
      )
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

export function MaterialNotice() {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin ?? false)
  const noticeQuery = useNotice()
  const update = useUpdateNotice()
  const del = useDeleteNotice()

  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')

  const notice = noticeQuery.data
  const visible = notice?.visible ?? false
  const content = notice?.content ?? ''

  const openEditor = () => {
    setDraft(content.trim() ? content : DEFAULT_CONTENT)
    setEditing(true)
  }

  const onSave = () => {
    const text = draft.trim()
    if (!text) return
    update.mutate(text, { onSuccess: () => setEditing(false) })
  }

  // 加载中 / 出错：不渲染（避免抖动与白条）。
  if (noticeQuery.isPending || noticeQuery.isError) return null

  // 编辑态（管理员）：内联 Textarea。
  if (editing) {
    return (
      <div className="mb-4 rounded-lg border border-border bg-bg-subtle px-4 py-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          autoFocus
          placeholder="写一句致谢…（链接会自动变成可点击）"
          className="resize-none border-0 bg-transparent px-0 py-0 text-[13px] leading-relaxed shadow-none focus-visible:ring-0"
          aria-label="编辑致谢内容"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setEditing(false)}
            disabled={update.isPending}
          >
            <X className="size-3.5" />
            取消
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={onSave}
            disabled={!draft.trim() || update.isPending}
          >
            <Check className="size-3.5" />
            保存
          </Button>
        </div>
      </div>
    )
  }

  // 隐藏态：管理员看到「添加」入口；普通用户什么都不渲染。
  if (!visible) {
    if (!isAdmin) return null
    return (
      <button
        type="button"
        onClick={openEditor}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-faint transition-colors hover:bg-bg-subtle hover:text-text-muted"
      >
        <Plus className="size-3.5" />
        添加致谢信息
      </button>
    )
  }

  // 展示态长条。
  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-2.5 rounded-lg border border-border bg-bg-subtle px-4 py-2.5',
      )}
    >
      <Heart
        aria-hidden
        className="mt-[3px] size-3.5 shrink-0 text-cat-course"
        strokeWidth={1.75}
      />
      <p className="m-0 min-w-0 flex-1 text-[13px] leading-relaxed text-text-muted">
        {renderContent(content)}
      </p>
      {isAdmin ? (
        <div className="-mr-1 flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-text-faint hover:text-text"
            aria-label="编辑致谢"
            title="编辑致谢"
            onClick={openEditor}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-text-faint hover:text-cat-research"
            aria-label="删除致谢"
            title="删除致谢"
            onClick={() => del.mutate()}
            disabled={del.isPending}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
