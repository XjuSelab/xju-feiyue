import * as React from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/cn'

import { useDeleteNotice, useNotice, useUpdateNotice } from '../hooks/useMaterials'

/**
 * 资料列表页顶部的「致谢信息条」—— 顶部行里、夹在「共 N 份课程资料」与搜索框
 * 之间的一条**白底小圆角细长条**，字号/字色贴合计数文案（13px / text-muted）。
 *
 * 语义：
 * - 共享读：`visible` 时所有人可见；内容里的 http(s) 链接渲染为可点击（github 短链）。
 * - 单行展示，放不下时**右侧渐变淡出**（不换行、不撑高顶部行）；完整内容见 title。
 * - 管理员（`user.isAdmin`）可编辑内容（**弹窗** Textarea）与删除/隐藏（软隐藏，
 *   内容保留）；隐藏后管理员看到「添加致谢」入口可恢复。
 * - 加载中/出错/普通用户隐藏态：不渲染，避免顶部行抖动。
 *
 * toast 在 hook 层（useUpdateNotice / useDeleteNotice），不在渲染期调用。
 */

/** 隐藏态下管理员点「添加」时预填的默认文案（与后端迁移 seed 对齐，已精简）。 */
const DEFAULT_CONTENT =
  '📚 感谢黄耀增学长贡献课程资料，源自 https://github.com/XJU-OpenHub/XjuCsMajorResources 🙏'

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

  const [editOpen, setEditOpen] = React.useState(false)
  const [draft, setDraft] = React.useState('')

  const notice = noticeQuery.data
  const visible = notice?.visible ?? false
  const content = notice?.content ?? ''

  const openEditor = () => {
    setDraft(content.trim() ? content : DEFAULT_CONTENT)
    setEditOpen(true)
  }

  const onSave = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || update.isPending) return
    update.mutate(text, { onSuccess: () => setEditOpen(false) })
  }

  // 编辑弹窗：管理员编辑/新建/恢复内容（始终挂载，由 editOpen 控制）。
  const dialog = isAdmin ? (
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSave}>
          <DialogHeader>
            <DialogTitle className="font-serif text-text">编辑致谢信息</DialogTitle>
            <DialogDescription className="text-text-muted">
              显示在资料页顶部的致谢长条。链接（http/https）会自动渲染为可点击。
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              autoFocus
              placeholder="写一句致谢…"
              className="resize-none text-[13px] leading-relaxed"
              aria-label="致谢内容"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!draft.trim() || update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  ) : null

  // 加载中 / 出错：不渲染（避免顶部行抖动）。
  if (noticeQuery.isPending || noticeQuery.isError) return null

  // 隐藏态：管理员看到「添加致谢」入口；普通用户什么都不渲染。
  if (!visible) {
    if (!isAdmin) return null
    return (
      <>
        <button
          type="button"
          onClick={openEditor}
          className="order-last inline-flex h-7 items-center gap-1.5 self-center rounded-md px-2 text-[13px] text-text-faint transition-colors hover:bg-bg-subtle hover:text-text-muted sm:order-none"
        >
          <Plus className="size-3.5" />
          添加致谢
        </button>
        {dialog}
      </>
    )
  }

  // 展示态：白底小圆角细长条，夹在计数与搜索框之间；溢出右侧渐变淡出。
  return (
    <>
      <div
        className={cn(
          'group order-last flex h-7 w-full min-w-0 items-center gap-2 self-center rounded-md',
          'border border-border bg-bg px-3 sm:order-none sm:w-auto sm:min-w-[14rem] sm:flex-1',
        )}
      >
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <p
            className="m-0 whitespace-nowrap text-[13px] leading-7 text-text-muted"
            title={content}
          >
            {renderContent(content)}
          </p>
          {/* 右侧渐变淡出（覆盖溢出尾部，pointer-events-none 不挡链接点击） */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent"
          />
        </div>
        {isAdmin ? (
          <div className="-mr-1.5 flex shrink-0 items-center opacity-70 transition-opacity hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-text-faint hover:text-text"
              aria-label="编辑致谢"
              title="编辑致谢"
              onClick={openEditor}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-text-faint hover:text-cat-research"
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
      {dialog}
    </>
  )
}
