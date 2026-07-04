import { Inbox } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useDecideJoinRequest, useJoinRequests } from '../../hooks/useGroups'

type Props = {
  gid: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 待审批列表 —— 逐行 通过 / 拒绝（组长/班委）。 */
export function JoinRequestsDialog({ gid, open, onOpenChange }: Props) {
  const { data: requests, isLoading } = useJoinRequests(gid, open)
  const decide = useDecideJoinRequest(gid)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>加入申请</DialogTitle>
          <DialogDescription>通过后对方立即成为组员（一人只能加入一个小组）。</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingSkeleton preset="paragraph" count={1} />
        ) : !requests || requests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-text-muted">
            <Inbox size={20} aria-hidden />
            <p className="m-0 text-sm">暂无待处理的申请</p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <Avatar className="size-8">
                  {r.avatarThumb && <AvatarImage src={resolveAssetUrl(r.avatarThumb)} alt="" />}
                  <AvatarFallback className="text-xs">{r.nickname.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text">{r.nickname}</div>
                  {r.message && (
                    <div className="truncate text-xs text-text-muted">{r.message}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ reqId: r.id, approve: true })}
                >
                  通过
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ reqId: r.id, approve: false })}
                >
                  拒绝
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
