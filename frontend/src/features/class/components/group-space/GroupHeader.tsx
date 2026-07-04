import { useRef, useState } from 'react'
import { Crown, ImagePlus, Inbox, LogOut, Trash2, UserMinus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { resolveAssetUrl } from '@/api/client'
import type { GroupDetail } from '@/api/schemas/class'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  useDeleteGroup,
  useRemoveMember,
  useTransferLeader,
  useUploadGroupLogo,
} from '../../hooks/useGroups'
import { GroupLogo } from '../groups/GroupLogo'
import { JoinRequestsDialog } from './JoinRequestsDialog'

type Props = {
  group: GroupDetail
  canManage: boolean
  currentSid: string
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024

/**
 * 小组空间头部 —— Logo（管理者可点击换图）+ 组名 + 成员 chips（管理者
 * hover 出移除/转让菜单）+ 待审批入口 + 退出/解散。
 */
export function GroupHeader({ group, canManage, currentSid }: Props) {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadLogo = useUploadGroupLogo(group.id)
  const removeMember = useRemoveMember(group.id)
  const transfer = useTransferLeader(group.id)
  const deleteGroup = useDeleteGroup()
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [confirmDissolve, setConfirmDissolve] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const isLeader = group.myRole === 'leader'
  const isPlainMember = group.myRole === 'member'

  const onLogoSelected = (file: File | undefined) => {
    if (!file || file.size > MAX_LOGO_BYTES) return
    uploadLogo.mutate(file)
  }

  return (
    <header className="flex flex-wrap items-start gap-4">
      <div className="relative">
        <GroupLogo
          gid={group.id}
          name={group.name}
          logo={group.logo}
          logoThumb={group.logoThumb}
          className="size-16 text-base"
        />
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="更换小组 Logo"
              className="absolute -bottom-1 -right-1 grid size-6 place-content-center rounded-full border border-border bg-bg text-text-muted shadow-sm transition hover:text-text"
            >
              <ImagePlus size={12} aria-hidden />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onLogoSelected(e.target.files?.[0])}
            />
          </>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 font-serif text-2xl font-semibold text-text">{group.name}</h1>
          {isLeader && <Badge>组长</Badge>}
        </div>

        <ul className="m-0 mt-2 flex list-none flex-wrap items-center gap-1.5 p-0">
          {group.members.map((m) => {
            const chip = (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-subtle py-0.5 pl-0.5 pr-2 text-xs text-text">
                <Avatar className="size-5">
                  {m.avatarThumb && <AvatarImage src={resolveAssetUrl(m.avatarThumb)} alt="" />}
                  <AvatarFallback className="text-[9px]">{m.nickname.slice(0, 2)}</AvatarFallback>
                </Avatar>
                {m.nickname}
                {m.role === 'leader' && (
                  <Crown size={11} aria-hidden className="text-cat-kaggle" />
                )}
              </span>
            )
            // 管理者可对非组长成员操作：移除 / 转让组长。
            if (!canManage || m.role === 'leader') {
              return <li key={m.sid}>{chip}</li>
            }
            return (
              <li key={m.sid}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`管理成员 ${m.nickname}`}>
                      {chip}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => transfer.mutate(m.sid)}>
                      <Crown size={13} aria-hidden className="mr-1.5" />
                      转让组长给 {m.nickname}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-cat-research focus:text-cat-research"
                      onClick={() => removeMember.mutate({ sid: m.sid, isSelf: false })}
                    >
                      <UserMinus size={13} aria-hidden className="mr-1.5" />
                      移出小组
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex items-center gap-2">
        {canManage && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setRequestsOpen(true)}>
                  <Inbox size={14} aria-hidden className="mr-1.5" />
                  加入申请
                  {group.pendingCount > 0 && (
                    <Badge className="ml-1.5 px-1.5 py-0 text-[10px]">{group.pendingCount}</Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>审批同学的加入申请</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isPlainMember && (
          <Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>
            <LogOut size={14} aria-hidden className="mr-1.5" />
            退出小组
          </Button>
        )}
        {isLeader && (
          <Button
            variant="outline"
            size="sm"
            className="text-cat-research"
            onClick={() => setConfirmDissolve(true)}
          >
            <Trash2 size={14} aria-hidden className="mr-1.5" />
            解散小组
          </Button>
        )}
      </div>

      <JoinRequestsDialog gid={group.id} open={requestsOpen} onOpenChange={setRequestsOpen} />

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>退出「{group.name}」？</AlertDialogTitle>
            <AlertDialogDescription>退出后需重新申请才能再次加入。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                removeMember.mutate(
                  { sid: currentSid, isSelf: true },
                  { onSuccess: () => navigate('/class') },
                )
              }
            >
              退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDissolve} onOpenChange={setConfirmDissolve}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解散「{group.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              小组的文件与任务将一并删除，成员可自由加入其他小组。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteGroup.mutate(group.id, { onSuccess: () => navigate('/class') })
              }
            >
              解散
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
