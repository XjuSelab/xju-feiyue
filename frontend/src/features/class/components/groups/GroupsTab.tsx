import { useState } from 'react'
import { Plus, UsersRound } from 'lucide-react'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'

import { useGroups } from '../../hooks/useGroups'
import { CreateGroupDialog } from './CreateGroupDialog'
import { GroupCard } from './GroupCard'

/**
 * 小组 tab —— 卡片网格。已入组用户不再显示「创建小组」（一人一组）。
 */
export function GroupsTab() {
  const { data: groups, isLoading, isError, refetch } = useGroups(true)
  const [createOpen, setCreateOpen] = useState(false)

  if (isLoading) return <LoadingSkeleton preset="paragraph" count={2} />
  if (isError || !groups) {
    return <ErrorState title="小组加载失败" message="请稍后重试。" onRetry={() => void refetch()} />
  }

  const inGroup = groups.some((g) => g.myRole != null)

  return (
    <section aria-label="小组">
      {!inGroup && (
        <div className="mb-4">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} aria-hidden className="mr-1.5" />
            创建小组
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="班里还没有小组"
          description="创建第一个小组，成为组长并邀请同学加入。"
          action={{ label: '创建小组', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </ul>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </section>
  )
}
