import { toast } from 'sonner'
import { ApiError, useMyBlocks, useUnblockUser } from '@/api'
import { Button } from '@/components/ui/button'

/** The current user's blocked list with one-click unblock. */
export function BlocksList() {
  const q = useMyBlocks(true)
  const unblock = useUnblockUser()
  const blocks = q.data ?? []

  const onUnblock = (sid: string) => {
    unblock.mutate(sid, {
      onSuccess: () => toast.success('已取消拉黑'),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : '操作失败'),
    })
  }

  if (q.isLoading) return <p className="text-sm text-text-muted">加载…</p>
  if (blocks.length === 0) return <p className="text-sm text-text-faint">你还没有拉黑任何人。</p>

  return (
    <ul className="space-y-2">
      {blocks.map((b) => (
        <li
          key={b.user.sid}
          className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-subtle text-xs font-medium text-text">
            {b.user.avatarThumb || b.user.avatar ? (
              <img
                src={b.user.avatarThumb ?? b.user.avatar ?? ''}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              b.user.nickname.slice(0, 2).toUpperCase()
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-text">{b.user.nickname}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onUnblock(b.user.sid)}
            disabled={unblock.isPending}
          >
            取消拉黑
          </Button>
        </li>
      ))}
    </ul>
  )
}
