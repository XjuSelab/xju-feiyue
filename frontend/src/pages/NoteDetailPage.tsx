import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Heart,
  MessageSquare,
  MessageSquareOff,
  PanelRight,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { notesApi, useNote, useToggleLike, ApiError } from '@/api'
import { CategoryBadge } from '@/components/common/CategoryBadge'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Markdown } from '@/components/common/Markdown'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CommentSection, type CommentSectionHandle } from '@/features/comments/CommentSection'
import { useCommentViewMode } from '@/features/comments/useCommentViewMode'
import { useTextSelection } from '@/features/comments/useTextSelection'
import { QuoteBubble } from '@/features/comments/QuoteBubble'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/cn'
import 'highlight.js/styles/github.css'

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: note, isLoading, error, refetch } = useNote(id ?? '')

  const authMode = useAuthStore((s) => s.mode)
  const currentSid = useAuthStore((s) => s.user?.sid)
  const toggleLike = useToggleLike()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [viewMode, setViewMode] = useCommentViewMode()

  const contentRef = useRef<HTMLDivElement | null>(null)
  const commentSectionRef = useRef<CommentSectionHandle | null>(null)
  const selection = useTextSelection(contentRef)

  if (isLoading) {
    return (
      <section data-page="note-detail" className="mx-auto max-w-3xl px-6 py-12">
        <LoadingSkeleton preset="paragraph" count={4} />
      </section>
    )
  }

  if (error || !note) {
    return (
      <section data-page="note-detail" className="mx-auto max-w-3xl px-6 py-12">
        <ErrorState
          message={error instanceof Error ? error.message : '笔记加载失败'}
          onRetry={() => refetch()}
        />
      </section>
    )
  }

  const isAuthor = !!currentSid && currentSid === note.author.sid

  const onLikeClick = () => {
    if (authMode !== 'authed') {
      toast.error('请先登录后再点赞')
      return
    }
    toggleLike.mutate({ id: note.id, liked: note.likedByMe })
  }

  const onConfirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await notesApi.deleteNote(note.id)
      toast.success('已删除')
      void qc.invalidateQueries({ queryKey: ['notes'] })
      navigate('/')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '删除失败，请稍后再试'
      toast.error(msg)
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  const onQuotePick = () => {
    if (!selection) return
    commentSectionRef.current?.startQuote({
      text: selection.text,
      offsetStart: selection.offsetStart,
      offsetEnd: selection.offsetEnd,
    })
    // Drop the selection so the bubble disappears and the textarea takes focus.
    window.getSelection()?.removeAllRanges()
    // If the user is in 'off' mode, surfacing the quote button must also
    // bring back inline comments — they explicitly asked to comment.
    if (viewMode === 'off') setViewMode('inline')
  }

  const onQuoteClick = (anchorText: string) => {
    const root = contentRef.current
    if (!root) return
    // Walk text nodes to locate the first occurrence of anchorText in the
    // rendered body. Concatenating data lets the match span Text-node
    // boundaries (rehype-highlight breaks inline runs into many spans).
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let total = ''
    let n: Node | null = walker.nextNode()
    while (n) {
      nodes.push(n as Text)
      total += (n as Text).data
      n = walker.nextNode()
    }
    let start = total.indexOf(anchorText)
    let end = start + anchorText.length
    if (start < 0) {
      // Selection.toString() collapses newlines to spaces but the rendered
      // textContent preserves them — fall back to a whitespace-tolerant
      // regex so anchors that span hard breaks still resolve.
      const pattern = anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
      const m = new RegExp(pattern).exec(total)
      if (!m) {
        toast.info('未找到对应原文段（可能已被编辑）')
        return
      }
      start = m.index
      end = start + m[0].length
    }
    const range = makeRangeAt(nodes, start, end)
    if (!range) return
    const rect = range.getBoundingClientRect()
    window.scrollTo({
      top: window.scrollY + rect.top - window.innerHeight / 3,
      behavior: 'smooth',
    })

    // Prefer the CSS Custom Highlight API — it doesn't mutate the DOM and
    // works across inline boundaries (a quoted span that straddles <a> /
    // <code> / hljs token spans would make surroundContents throw).
    //
    // Duck-type rather than instanceof Map: CSS.highlights is a
    // HighlightRegistry which *quacks* like a Map but does not extend it.
    const HL_NAME = 'flash-anchor'
    type HighlightRegistryLike = {
      set: (k: string, v: object) => void
      delete: (k: string) => void
    }
    const cssHighlights = (CSS as unknown as { highlights?: HighlightRegistryLike }).highlights
    const HighlightCtor = (window as unknown as { Highlight?: new (r: Range) => object }).Highlight
    if (cssHighlights && typeof cssHighlights.set === 'function' && HighlightCtor) {
      const hl = new HighlightCtor(range)
      cssHighlights.set(HL_NAME, hl)
      window.setTimeout(() => cssHighlights.delete(HL_NAME), 1600)
      return
    }

    // Fallback: wrap with <mark.flash-highlight> for older browsers. May
    // skip the highlight if the range crosses inline parents.
    const mark = document.createElement('mark')
    mark.className = 'flash-highlight'
    try {
      range.surroundContents(mark)
    } catch {
      return
    }
    window.setTimeout(() => {
      const parent = mark.parentNode
      if (!parent) return
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
      parent.normalize()
    }, 1600)
  }

  const article = (
    <>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-faint hover:text-text-muted"
      >
        <ArrowLeft size={14} aria-hidden /> 返回
      </Link>

      <div className="mb-3 flex items-center gap-3 text-xs text-text-faint">
        <CategoryBadge categoryId={note.category} variant="chip" />
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden /> {note.readMinutes} min
        </span>
        <span aria-hidden>·</span>
        <span>
          {new Date(note.createdAt).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>

      <h1 className="mb-3 font-serif text-3xl font-semibold leading-tight text-text">
        {note.title}
      </h1>
      <p className="mb-6 text-base leading-relaxed text-text-muted">{note.summary}</p>

      <div className="mb-8 flex flex-wrap items-center gap-3 border-y border-border py-3 text-sm">
        <span className="inline-flex size-7 items-center justify-center overflow-hidden rounded-full bg-bg-subtle text-xs font-medium text-text">
          {note.author.avatarThumb || note.author.avatar ? (
            <img
              src={note.author.avatarThumb ?? note.author.avatar ?? ''}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            note.author.nickname.slice(0, 2).toUpperCase()
          )}
        </span>
        <span className="text-text">{note.author.nickname}</span>

        {isAuthor && (
          <span className="inline-flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-text-muted"
            >
              <Link to={`/write/note/${note.id}`}>
                <Pencil size={12} aria-hidden /> 编辑
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              className="h-7 gap-1 px-2 text-xs text-text-muted hover:text-red-500"
            >
              <Trash2 size={12} aria-hidden /> 删除
            </Button>
          </span>
        )}

        <span className="ml-auto inline-flex items-center gap-3 text-xs text-text-faint">
          <CommentViewToggle mode={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={onLikeClick}
            disabled={toggleLike.isPending}
            aria-label={note.likedByMe ? '取消点赞' : '点赞'}
            aria-pressed={note.likedByMe}
            className={cn(
              'inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong',
              note.likedByMe && 'text-red-500 hover:text-red-500',
            )}
          >
            <Heart size={12} aria-hidden fill={note.likedByMe ? 'currentColor' : 'none'} />{' '}
            {note.likes}
          </button>
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={12} aria-hidden /> {note.comments}
          </span>
        </span>
      </div>

      <div
        ref={contentRef}
        // The body is read-only — silence any accidental focus caret that
        // browsers sometimes show on focusable scrollable children (e.g.
        // <pre overflow:auto>) or via Caret Browsing mode. Selection
        // highlighting still works normally.
        style={{ caretColor: 'transparent' }}
      >
        {note.content ? (
          <Markdown content={note.content} />
        ) : (
          <p className="text-sm italic text-text-faint">（这篇笔记暂无正文）</p>
        )}
      </div>

      {note.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6 text-xs text-text-muted">
          {note.tags.map((t) => (
            <span key={t} className="rounded-full bg-bg-subtle px-2.5 py-0.5">
              #{t}
            </span>
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      <section
        data-page="note-detail"
        data-comment-view={viewMode}
        className={cn(
          'relative px-6 py-12',
          viewMode === 'drawer'
            ? 'mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px]'
            : 'mx-auto max-w-3xl',
        )}
      >
        <article className={viewMode === 'drawer' ? 'min-w-0' : ''}>{article}</article>

        {viewMode === 'inline' && (
          <CommentSection
            ref={commentSectionRef}
            noteId={note.id}
            noteAuthorSid={note.author.sid}
            variant="inline"
            onQuoteClick={onQuoteClick}
          />
        )}
        {viewMode === 'drawer' && (
          <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] overflow-y-auto rounded-md border border-border bg-bg p-4 lg:block">
            <CommentSection
              ref={commentSectionRef}
              noteId={note.id}
              noteAuthorSid={note.author.sid}
              variant="drawer"
              onQuoteClick={onQuoteClick}
            />
          </aside>
        )}
      </section>

      <QuoteBubble
        position={selection ? { x: selection.rect.x, y: selection.rect.y } : null}
        onPick={onQuotePick}
      />

      <Dialog open={confirmOpen} onOpenChange={(o) => !deleting && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除这篇笔记？</DialogTitle>
            <DialogDescription>删除后将无法恢复，相关点赞与评论也会一并清除。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={onConfirmDelete}
              disabled={deleting}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deleting ? '删除中…' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Build a Range that spans `[start, end)` across a flat list of text nodes.
 *
 * Bias on boundaries: start uses strict `<` so a position right at a node's
 * end lands at offset 0 of the next node — that keeps the start inside the
 * node we're about to read, which is what `surroundContents` needs to avoid
 * crossing parent spans (rehype-highlight chops a single word into adjacent
 * <span class="hljs-*"> children).
 */
function makeRangeAt(nodes: Text[], start: number, end: number): Range | null {
  if (nodes.length === 0 || end <= start) return null
  let acc = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0
  for (const n of nodes) {
    const next = acc + n.data.length
    if (startNode === null && start < next) {
      startNode = n
      startOffset = start - acc
    }
    if (end <= next) {
      endNode = n
      endOffset = end - acc
      break
    }
    acc = next
  }
  if (!startNode || !endNode) return null
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}

type ToggleProps = {
  mode: 'inline' | 'drawer' | 'off'
  onChange: (m: 'inline' | 'drawer' | 'off') => void
}

function CommentViewToggle({ mode, onChange }: ToggleProps) {
  const opts: Array<{ value: ToggleProps['mode']; label: string; icon: React.ReactNode }> = [
    { value: 'inline', label: '文末楼层', icon: <MessageSquare size={12} aria-hidden /> },
    { value: 'drawer', label: '侧边栏', icon: <PanelRight size={12} aria-hidden /> },
    { value: 'off', label: '不看评论', icon: <MessageSquareOff size={12} aria-hidden /> },
  ]
  return (
    <span
      role="group"
      aria-label="评论显示模式"
      className="inline-flex items-center rounded border border-border"
    >
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.label}
          aria-pressed={mode === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center px-1.5 py-0.5 transition',
            mode === o.value ? 'bg-bg-subtle text-text' : 'text-text-faint hover:text-text-muted',
          )}
        >
          {o.icon}
        </button>
      ))}
    </span>
  )
}
