import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Heart, MessageSquare, Pencil, Trash2 } from 'lucide-react'
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

  return (
    <section data-page="note-detail" className="mx-auto max-w-3xl px-6 py-12">
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

      <div className="mb-8 flex items-center gap-3 border-y border-border py-3 text-sm">
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

        <span className="ml-auto inline-flex items-center gap-4 text-xs text-text-faint">
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

      {note.content ? (
        <Markdown content={note.content} />
      ) : (
        <p className="text-sm italic text-text-faint">（这篇笔记暂无正文）</p>
      )}

      {note.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6 text-xs text-text-muted">
          {note.tags.map((t) => (
            <span key={t} className="rounded-full bg-bg-subtle px-2.5 py-0.5">
              #{t}
            </span>
          ))}
        </div>
      )}

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
    </section>
  )
}
