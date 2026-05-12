import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useComments, useCreateComment, useDeleteComment, type Comment } from '@/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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

  const [content, setContent] = useState('')
  const [quote, setQuote] = useState<QuoteContext | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)

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

  const flatComments: Comment[] = query.data?.pages.flatMap((p) => p.items) ?? []

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
        anchorText: quote?.text ?? null,
        anchorOffsetStart: quote?.offsetStart ?? null,
        anchorOffsetEnd: quote?.offsetEnd ?? null,
      },
      {
        onSuccess: () => {
          setContent('')
          setQuote(null)
        },
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : '评论发送失败'
          toast.error(msg)
        },
      },
    )
  }

  const onDelete = (commentId: string) => {
    deleteMut.mutate(commentId, {
      onError: (e) => {
        const msg = e instanceof ApiError ? e.message : '删除评论失败'
        toast.error(msg)
      },
    })
  }

  const heading = (
    <h2 className="font-serif text-lg font-semibold text-text">
      评论{' '}
      {flatComments.length > 0 && <span className="text-text-faint">· {flatComments.length}</span>}
    </h2>
  )

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
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!isAuthed || createMut.isPending}
          placeholder={isAuthed ? '说点什么…' : '登录后评论'}
          rows={3}
          maxLength={4000}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-text-faint">
            {isAuthed ? `${content.length}/4000` : '游客可阅读，不能发评论'}
          </span>
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
        {!query.isLoading && flatComments.length === 0 && (
          <li className="text-sm text-text-faint">还没有评论，抢沙发吧。</li>
        )}
        {flatComments.map((c, idx) => {
          const canDelete = !!me && (me.sid === c.author.sid || me.sid === noteAuthorSid)
          const hasAnchor = !!c.anchorText
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
                  <span className="font-medium text-text">
                    #{flatComments.length - idx} {c.author.nickname}
                  </span>
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
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text">
                  {c.content}
                </p>
              </div>
            </li>
          )
        })}
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
