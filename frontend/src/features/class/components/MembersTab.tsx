import { useState } from 'react'
import { Star, StarOff } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import type { ClassMember } from '@/api/schemas/class'
import { CommitteeBadge } from '@/components/common/CommitteeBadge'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useAuthStore } from '@/stores/authStore'

import { useClassMe, useClassMembers, useSetMemberCommittee } from '../hooks/useClass'
import { SetMemberCommitteeDialog } from './SetMemberCommitteeDialog'

/**
 * 成员 tab —— 全班同学网格（头像 + 昵称 + 职务着色徽标）。
 *
 * 右键成员卡片可设置班委：超管任意（含授予「班长」）；本班班长可设/撤
 * 普通班委，但「班长」职务与现任班长只归超管管（后端同规则强制）。
 */
export function MembersTab() {
  const { data: members, isLoading, isError, refetch } = useClassMembers(true)
  const { data: me } = useClassMe()
  const user = useAuthStore((s) => s.user)
  const setCommittee = useSetMemberCommittee()

  const [editTarget, setEditTarget] = useState<ClassMember | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ClassMember | null>(null)

  const isSuperAdmin = user?.isSuperAdmin === true
  const isBanzhang = me?.committeeTitle === '班长'
  const canManage = isSuperAdmin || isBanzhang
  // 非超管不能动现任班长（含自己）。
  const canTouch = (m: ClassMember) =>
    canManage && (isSuperAdmin || m.committeeTitle !== '班长')

  if (isLoading) return <LoadingSkeleton preset="paragraph" count={2} />
  if (isError || !members) {
    return <ErrorState title="成员加载失败" message="请稍后重试。" onRetry={() => void refetch()} />
  }

  return (
    <>
      {canManage && (
        <p className="m-0 mb-3 text-xs text-text-faint">
          右键成员卡片可设置班委职务{isSuperAdmin ? '（含班长）' : '（「班长」由超管设置）'}。
        </p>
      )}
      <ul className="grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
        {members.map((m) => {
          const card = (
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
                  {m.isClassCommittee && <CommitteeBadge title={m.committeeTitle} />}
                </div>
                <div className="truncate text-xs text-text-faint">{m.sid}</div>
              </div>
            </li>
          )

          if (!canTouch(m)) return card

          return (
            <ContextMenu key={m.sid}>
              <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem className="gap-2" onSelect={() => setEditTarget(m)}>
                  <Star className="size-4" />
                  {m.isClassCommittee ? '修改班委职务' : '设为班委'}
                </ContextMenuItem>
                {m.isClassCommittee && (
                  <ContextMenuItem
                    className="gap-2 text-cat-research"
                    onSelect={() => setCancelTarget(m)}
                  >
                    <StarOff className="size-4" />
                    取消班委
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </ul>

      <SetMemberCommitteeDialog
        member={editTarget}
        open={editTarget != null}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null)
        }}
        allowBanzhang={isSuperAdmin}
      />

      <AlertDialog
        open={cancelTarget != null}
        onOpenChange={(o) => (!o ? setCancelTarget(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">取消班委？</AlertDialogTitle>
            <AlertDialogDescription>
              将取消 <strong>{cancelTarget?.nickname}</strong>（
              {cancelTarget?.committeeTitle ?? '班委'}）的班委身份，TA
              将无法再发起点名或审批小组申请。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelTarget) {
                  setCommittee.mutate({ sid: cancelTarget.sid, isClassCommittee: false })
                }
                setCancelTarget(null)
              }}
            >
              确定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
