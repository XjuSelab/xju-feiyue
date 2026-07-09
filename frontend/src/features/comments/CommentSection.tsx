import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Flag, Heart, ImageIcon, Send, ThumbsDown, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useToggleCommentReaction,
  type Comment,
} from '@/api'
import { uploadNoteImage } from '@/api/endpoints/uploads'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ReportDialog } from '@/features/reports/ReportDialog'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/cn'

export type QuoteContext = {
  text: string
  offsetStart: number
  offsetEnd: number
}

export type CommentSectionHandle = {
  startQuote: (q: QuoteContext) => void
  /** Scroll a comment li into view and run a 1.6 s flash on it. No-op when not found. */
  flashComment: (commentId: string) => void
}

type ReplyTarget = { parentId: string; replyToSid: string; nickname: string }

type Props = {
  noteId: string
  noteAuthorSid: string
  /** 'inline' renders inside the article flow; 'drawer' renders compact for a side panel. */
  variant?: 'inline' | 'drawer'
  /**
   * Click handler for anchored quotes — receives the quoted text so the
   * caller can scroll to and flash the matching span in the note body.
   * Quotes render as clickable blockquotes when this is provided.
   */
  onQuoteClick?: (anchorText: string) => void
  /**
   * Comment id whose article-anchor is currently hovered. The matching li
   * gets the .anchor-active class so the user can see both ends linked.
   */
  activeCommentId?: string | null
  /** Fires when the cursor enters / leaves an anchored comment li. */
  onCommentHover?: (commentId: string | null) => void
}

export const CommentSection = forwardRef<CommentSectionHandle, Props>(function CommentSection(
  { noteId, noteAuthorSid, variant = 'inline', onQuoteClick, activeCommentId, onCommentHover },
  ref,
) {
  const authMode = useAuthStore((s) => s.mode)
  const me = useAuthStore((s) => s.user)
  const isAuthed = authMode === 'authed'

  const query = useComments(noteId)
  const createMut = useCreateComment(noteId)
  const deleteMut = useDeleteComment(noteId)
  const reactMut = useToggleCommentReaction(noteId)

  const [content, setContent] = useState('')
  const [quote, setQuote] = useState<QuoteContext | null>(null)
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      startQuote: (q: QuoteContext) => {
        setQuote(q)
        // Focus next tick so the textarea exists.
        requestAnimationFrame(() => textareaRef.current?.focus())
      },
      flashComment: (commentId: string) => {
        const root = sectionRef.current
        if (!root) return
        const li = root.querySelector(
          `li[data-comment-id="${cssEscape(commentId)}"]`,
        ) as HTMLLIElement | null
        if (!li) return
        li.scrollIntoView({ block: 'center', behavior: 'smooth' })
        li.classList.add('flash-comment')
        window.setTimeout(() => li.classList.remove('flash-comment'), 1600)
      },
    }),
    [],
  )

  const flat: Comment[] = query.data?.pages.flatMap((p) => p.items) ?? []
  // Two-level 楼中楼: group loaded replies under their loaded parent. A reply
  // whose parent hasn't been loaded yet (rare, only across a page boundary)
  // gracefully falls back to a top-level item.
  const topIds = new Set(flat.filter((c) => !c.parentId).map((c) => c.id))
  const repliesByParent = new Map<string, Comment[]>()
  for (const c of flat) {
    if (c.parentId && topIds.has(c.parentId)) {
      const arr = repliesByParent.get(c.parentId) ?? []
      arr.push(c)
      repliesByParent.set(c.parentId, arr)
    }
  }
  for (const arr of repliesByParent.values()) {
    arr.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
  }
  const topLevel = flat.filter((c) => !c.parentId || !topIds.has(c.parentId))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    if (!isAuthed) {
      toast.error('请先登录后再评论')
      return
    }
    createMut.mutate(
      {
        content: trimmed,
        parentId: replyTarget?.parentId ?? null,
        replyToSid: replyTarget?.replyToSid ?? null,
        images,
        anchorText: quote?.text ?? null,
        anchorOffsetStart: quote?.offsetStart ?? null,
        anchorOffsetEnd: quote?.offsetEnd ?? null,
      },
      {
        onSuccess: () => {
          setContent('')
          setQuote(null)
          setReplyTarget(null)
          setImages([])
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : '评论发送失败'
          toast.error(msg)
        },
      },
    )
  }

  const onDelete = (commentId: string) => {
    deleteMut.mutate(commentId, {
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : '删除评论失败'
        toast.error(msg)
      },
    })
  }

  const onReply = (c: Comment) => {
    if (!isAuthed) {
      toast.error('请先登录后再回复')
      return
    }
    setReplyTarget({
      // Replies always attach to the top-level comment (backend rejects 3 levels).
      parentId: c.parentId ?? c.id,
      replyToSid: c.author.sid,
      nickname: c.author.nickname,
    })
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const onReact = (commentId: string, kind: 'like' | 'dislike', active: boolean) => {
    if (!isAuthed) {
      toast.error('请先登录后再操作')
      return
    }
    reactMut.mutate(
      { commentId, kind, active },
      {
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : '操作失败'
          toast.error(msg)
        },
      },
    )
  }

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same file
    if (files.length === 0) return
    const picked = files.slice(0, 9 - images.length)
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of picked) {
        const { url } = await uploadNoteImage(f)
        urls.push(url)
      }
      setImages((prev) => [...prev, ...urls])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '图片上传失败')
    } finally {
      setUploading(false)
    }
  }

  const onRemoveImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url))

  const heading = (
    <h2 className="font-serif text-lg font-semibold text-text">
      评论 {flat.length > 0 && <span className="text-text-faint">· {flat.length}</span>}
    </h2>
  )

  const renderComment = (c: Comment, isReply: boolean) => {
    const canDelete = !!me && (me.sid === c.author.sid || me.sid === noteAuthorSid)
    const hasAnchor = !!c.anchorText
    const replies = repliesByParent.get(c.id) ?? []
    return (
      <li
        key={c.id}
        data-comment-id={c.id}
        onMouseEnter={hasAnchor ? () => onCommentHover?.(c.id) : undefined}
        onMouseLeave={hasAnchor ? () => onCommentHover?.(null) : undefined}
        className={cn(
          'flex gap-3 rounded-md transition-colors',
          hasAnchor && '-mx-2 px-2 py-1',
          activeCommentId === c.id && 'anchor-active',
        )}
      >
        <span className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-subtle text-xs font-medium text-text">
          {c.author.avatarThumb || c.author.avatar ? (
            <img
              src={c.author.avatarThumb ?? c.author.avatar ?? ''}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            c.author.nickname.slice(0, 2).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-xs text-text-faint">
            <span className="font-medium text-text">{c.author.nickname}</span>
            {isReply && c.replyTo && (
              <span className="text-text-faint">回复 @{c.replyTo.nickname}</span>
            )}
            <span aria-hidden>·</span>
            <span>{formatRelative(c.createdAt)}</span>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                disabled={deleteMut.isPending}
                className="ml-auto inline-flex items-center gap-1 text-text-faint hover:text-red-500"
                aria-label="删除评论"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            )}
          </div>

          {c.anchorText &&
            (onQuoteClick ? (
              <button
                type="button"
                onClick={() => onQuoteClick(c.anchorText!)}
                aria-label="跳到原文这段"
                title="跳到原文这段"
                className="mt-1 block w-full cursor-pointer border-l-2 border-border-strong bg-bg-subtle px-3 py-1 text-left text-xs italic text-text-muted transition hover:border-text hover:text-text"
              >
                {c.anchorText}
              </button>
            ) : (
              <blockquote className="mt-1 border-l-2 border-border-strong bg-bg-subtle px-3 py-1 text-xs italic text-text-muted">
                {c.anchorText}
              </blockquote>
            ))}

          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text">{c.content}</p>

          {c.images.length > 0 && (
            <div className="mt-2 grid max-w-[16rem] grid-cols-3 gap-1.5">
              {c.images.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setLightbox(url)}
                  className="aspect-square overflow-hidden rounded bg-bg-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
                  aria-label="查看大图"
                >
                  <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-4 text-xs text-text-faint">
            <button
              type="button"
              onClick={() => onReact(c.id, 'like', c.likedByMe)}
              disabled={reactMut.isPending}
              aria-pressed={c.likedByMe}
              aria-label={c.likedByMe ? '取消点赞' : '点赞'}
              className={cn(
                'inline-flex items-center gap-1 transition hover:text-text-muted',
                c.likedByMe && 'text-red-500 hover:text-red-500',
              )}
            >
              <Heart size={12} aria-hidden fill={c.likedByMe ? 'currentColor' : 'none'} />
              {c.likes > 0 ? c.likes : ''}
            </button>
            <button
              type="button"
              onClick={() => onReact(c.id, 'dislike', c.dislikedByMe)}
              disabled={reactMut.isPending}
              aria-pressed={c.dislikedByMe}
              aria-label={c.dislikedByMe ? '取消点踩' : '点踩'}
              className={cn(
                'inline-flex items-center transition hover:text-text-muted',
                c.dislikedByMe && 'text-text',
              )}
            >
              <ThumbsDown size={12} aria-hidden fill={c.dislikedByMe ? 'currentColor' : 'none'} />
            </button>
            <button type="button" onClick={() => onReply(c)} className="transition hover:text-text-muted">
              回复
            </button>
            {me && me.sid !== c.author.sid && (
              <button
                type="button"
                onClick={() => setReportTarget(c.id)}
                aria-label="举报评论"
                className="inline-flex items-center gap-1 transition hover:text-text-muted"
              >
                <Flag size={11} aria-hidden /> 举报
              </button>
            )}
          </div>

          {replies.length > 0 && (
            <ul className="mt-3 space-y-3 border-l border-border pl-3">
              {replies.map((r) => renderComment(r, true))}
            </ul>
          )}
        </div>
      </li>
    )
  }

  return (
    <section
      ref={sectionRef}
      data-comments-variant={variant}
      className={cn(
        variant === 'inline' ? 'mt-12 border-t border-border pt-8' : 'flex h-full flex-col',
      )}
    >
      {heading}

      <form onSubmit={onSubmit} className="mt-4">
        {quote && (
          <div className="mb-2 flex items-start gap-2 rounded border-l-2 border-border-strong bg-bg-subtle px-3 py-2 text-xs text-text-muted">
            <span className="line-clamp-2 flex-1 italic">「{quote.text}」</span>
            <button
              type="button"
              onClick={() => setQuote(null)}
              aria-label="取消引用"
              className="text-text-faint hover:text-text"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        )}
        {replyTarget && (
          <div className="mb-2 flex items-center gap-2 rounded bg-bg-subtle px-3 py-1.5 text-xs text-text-muted">
            <span className="flex-1">回复 @{replyTarget.nickname}</span>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              aria-label="取消回复"
              className="text-text-faint hover:text-text"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!isAuthed || createMut.isPending}
          placeholder={isAuthed ? (replyTarget ? `回复 @${replyTarget.nickname}…` : '说点什么…') : '登录后评论'}
          rows={3}
          maxLength={4000}
        />
        {images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((url) => (
              <div key={url} className="relative size-14 overflow-hidden rounded bg-bg-subtle">
                <img src={url} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(url)}
                  aria-label="移除图片"
                  className="absolute right-0 top-0 rounded-bl bg-black/50 px-0.5 text-white"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isAuthed || uploading || images.length >= 9}
              className="inline-flex items-center gap-1 text-xs text-text-faint transition hover:text-text-muted disabled:opacity-50"
              aria-label="添加图片"
            >
              <ImageIcon size={14} aria-hidden />
              {uploading ? '上传中…' : `图片 ${images.length}/9`}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onPickImages}
            />
            <span className="text-xs text-text-faint">
              {isAuthed ? `${content.length}/4000` : '游客可阅读，不能发评论'}
            </span>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!isAuthed || createMut.isPending || content.trim().length === 0}
          >
            <Send size={12} aria-hidden />
            {createMut.isPending ? '发送中…' : '发送'}
          </Button>
        </div>
      </form>

      <ul className="mt-6 space-y-5">
        {query.isLoading && <li className="text-sm text-text-muted">加载评论…</li>}
        {!query.isLoading && flat.length === 0 && (
          <li className="text-sm text-text-faint">还没有评论，抢沙发吧。</li>
        )}
        {topLevel.map((c) => renderComment(c, false))}
      </ul>

      {query.hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? '加载中…' : '加载更多'}
          </Button>
        </div>
      )}

      <ReportDialog
        open={!!reportTarget}
        onOpenChange={(o) => !o && setReportTarget(null)}
        targetType="comment"
        targetId={reportTarget ?? ''}
      />

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="关闭"
            className="absolute right-4 top-4 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      )}
    </section>
  )
})

function cssEscape(s: string): string {
  // CSS.escape exists in all modern browsers; fall back to a minimal stringifier
  // for environments (jsdom, very old chromiums) where it isn't defined.
  const fn = (window.CSS as { escape?: (s: string) => string } | undefined)?.escape
  return fn ? fn(s) : s.replace(/["\\]/g, '\\$&')
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const day = 86_400_000
  const hour = 3_600_000
  const min = 60_000
  if (diffMs < min) return '刚刚'
  if (diffMs < hour) return `${Math.floor(diffMs / min)} 分钟前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}
