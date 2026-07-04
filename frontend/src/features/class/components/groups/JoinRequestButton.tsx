import type { Group, GroupDetail } from '@/api/schemas/class'
import { Button } from '@/components/ui/button'

import { useApplyToGroup, useCancelJoinRequest } from '../../hooks/useGroups'

type Props = { group: Group | GroupDetail; size?: 'sm' | 'default' }

/**
 * 申请加入按钮的三态：可申请 → 申请审核中（可撤回）→ 已是成员（不渲染）。
 */
export function JoinRequestButton({ group, size = 'sm' }: Props) {
  const apply = useApplyToGroup()
  const cancel = useCancelJoinRequest()

  if (group.myRole != null) return null

  if (group.myPendingRequestId) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-text-muted">申请审核中</span>
        <Button
          size={size}
          variant="outline"
          disabled={cancel.isPending}
          onClick={() =>
            cancel.mutate({ gid: group.id, reqId: group.myPendingRequestId as string })
          }
        >
          撤回
        </Button>
      </span>
    )
  }

  return (
    <Button
      size={size}
      disabled={apply.isPending}
      onClick={() => apply.mutate({ gid: group.id })}
    >
      {apply.isPending ? '提交中…' : '申请加入'}
    </Button>
  )
}
