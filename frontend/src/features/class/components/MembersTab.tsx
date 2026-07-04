import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { resolveAssetUrl } from '@/api/client'

import { useClassMembers } from '../hooks/useClass'

/** 成员 tab —— 全班同学网格（头像 + 昵称 + 班委徽标）。 */
export function MembersTab() {
  const { data: members, isLoading, isError, refetch } = useClassMembers(true)

  if (isLoading) return <LoadingSkeleton preset="paragraph" count={2} />
  if (isError || !members) {
    return <ErrorState title="成员加载失败" message="请稍后重试。" onRetry={() => void refetch()} />
  }

  return (
    <ul className="grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
      {members.map((m) => (
        <li
          key={m.sid}
          className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2.5"
        >
          <Avatar className="size-9">
            {m.avatarThumb && <AvatarImage src={resolveAssetUrl(m.avatarThumb)} alt="" />}
            <AvatarFallback className="text-xs">{m.nickname.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-text">{m.nickname}</span>
              {m.isClassCommittee && (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  班委
                </Badge>
              )}
            </div>
            <div className="truncate text-xs text-text-faint">{m.sid}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}
