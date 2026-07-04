import * as React from 'react'
import {
  GraduationCap,
  KeyRound,
  MoreHorizontal,
  Search,
  Shield,
  ShieldOff,
  Star,
  StarOff,
  UserPlus,
} from 'lucide-react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { cn } from '@/lib/cn'

import { Badge } from '@/components/ui/badge'

import { useAdminUsers, useSetRole, useSetUserCommittee } from '../hooks/useAdmin'
import { formatDate, formatRelative } from '../lib/format'
import type { AdminUserRow } from '@/api/schemas/admin'
import { RoleBadge } from './RoleBadge'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { ImportUserDialog } from './ImportUserDialog'
import { SetClassDialog } from './SetClassDialog'

/**
 * User-management table. Actions are rendered per the *actor's* privileges so
 * we don't tease buttons that the backend would 403:
 * - reset password: super-admin → users + admins; plain admin → users only;
 *   nobody → super-admins.
 * - promote/demote: super-admin only, never on a super-admin or on self.
 * The backend enforces all of this regardless (see routes/admin.py).
 */
export function UsersTab({
  currentSid,
  isSuperAdmin,
}: {
  currentSid: string
  isSuperAdmin: boolean
}) {
  const { data, isPending, isError, error, refetch } = useAdminUsers()
  const setRole = useSetRole()
  const setCommittee = useSetUserCommittee()

  const [q, setQ] = React.useState('')
  const [resetTarget, setResetTarget] = React.useState<AdminUserRow | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)
  const [roleTarget, setRoleTarget] = React.useState<AdminUserRow | null>(null)
  const [classTarget, setClassTarget] = React.useState<AdminUserRow | null>(null)
  const [committeeTarget, setCommitteeTarget] = React.useState<AdminUserRow | null>(null)

  const rows = React.useMemo(() => {
    const all = data ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return all
    return all.filter(
      (u) =>
        u.sid.includes(needle) ||
        u.nickname.toLowerCase().includes(needle) ||
        u.name.toLowerCase().includes(needle),
    )
  }, [data, q])

  const canReset = (u: AdminUserRow) =>
    u.role === 'superadmin' ? false : u.role === 'admin' ? isSuperAdmin : true
  const canChangeRole = (u: AdminUserRow) =>
    isSuperAdmin && u.role !== 'superadmin' && u.sid !== currentSid

  const confirmRoleChange = () => {
    if (!roleTarget) return
    const next = roleTarget.role === 'admin' ? 'user' : 'admin'
    setRole.mutate({ sid: roleTarget.sid, role: next })
    setRoleTarget(null)
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56 sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索学号 / 姓名 / 昵称…"
            className="pl-9"
            aria-label="搜索用户"
          />
        </div>
        <span className="text-sm text-text-muted">
          共 <strong className="font-semibold text-text">{rows.length}</strong> 人
        </span>
        <Button className="ml-auto gap-1.5" size="sm" onClick={() => setImportOpen(true)}>
          <UserPlus className="size-4" />
          导入用户
        </Button>
      </div>

      <Body isPending={isPending} isError={isError} message={error?.message} onRetry={() => void refetch()}>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-subtle text-left text-xs text-text-muted">
                <th className="px-3 py-2 font-medium">用户</th>
                <th className="px-3 py-2 font-medium">角色</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">班级</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">笔记</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">资料</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">最近登录</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">注册</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const reset = canReset(u)
                const role = canChangeRole(u)
                // 班级/班委由任意管理员设置（后端 require_admin），操作列始终可用。
                const hasActions = true
                return (
                  <tr key={u.sid} className="border-b border-border last:border-0 hover:bg-bg-subtle/60">
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-text">
                          {u.nickname}
                          {u.sid === currentSid ? (
                            <span className="ml-1.5 text-xs text-text-faint">（你）</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-text-faint">
                          {u.sid}
                          {u.name && u.name !== u.nickname ? ` · ${u.name}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      {u.classShortName ? (
                        <span className="inline-flex items-center gap-1.5 text-text-muted">
                          {u.classShortName}
                          {u.isClassCommittee ? (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              班委
                            </Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-text-muted sm:table-cell">
                      {u.noteCount}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-text-muted sm:table-cell">
                      {u.materialCount}
                    </td>
                    <td className="hidden px-3 py-2 text-text-muted md:table-cell">
                      {formatRelative(u.lastLoginAt)}
                    </td>
                    <td className="hidden px-3 py-2 text-text-faint lg:table-cell">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {hasActions ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="用户操作">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2" onSelect={() => setClassTarget(u)}>
                              <GraduationCap className="size-4" />
                              设置班级
                            </DropdownMenuItem>
                            {u.classShortName ? (
                              <DropdownMenuItem
                                className={cn('gap-2', u.isClassCommittee && 'text-cat-research')}
                                onSelect={() => setCommitteeTarget(u)}
                              >
                                {u.isClassCommittee ? (
                                  <>
                                    <StarOff className="size-4" />
                                    取消班委
                                  </>
                                ) : (
                                  <>
                                    <Star className="size-4" />
                                    设为班委
                                  </>
                                )}
                              </DropdownMenuItem>
                            ) : null}
                            {reset ? (
                              <DropdownMenuItem className="gap-2" onSelect={() => setResetTarget(u)}>
                                <KeyRound className="size-4" />
                                重置密码
                              </DropdownMenuItem>
                            ) : null}
                            {role ? (
                              <DropdownMenuItem
                                className={cn('gap-2', u.role === 'admin' && 'text-cat-research')}
                                onSelect={() => setRoleTarget(u)}
                              >
                                {u.role === 'admin' ? (
                                  <>
                                    <ShieldOff className="size-4" />
                                    取消管理员
                                  </>
                                ) : (
                                  <>
                                    <Shield className="size-4" />
                                    设为管理员
                                  </>
                                )}
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-text-faint">
                    没有匹配的用户
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Body>

      <ResetPasswordDialog
        user={resetTarget}
        open={resetTarget != null}
        onOpenChange={(o) => {
          if (!o) setResetTarget(null)
        }}
      />
      <ImportUserDialog open={importOpen} onOpenChange={setImportOpen} />
      <SetClassDialog
        user={classTarget}
        open={classTarget != null}
        onOpenChange={(o) => {
          if (!o) setClassTarget(null)
        }}
      />

      {/* 设/撤班委 confirmation */}
      <AlertDialog
        open={committeeTarget != null}
        onOpenChange={(o) => (!o ? setCommitteeTarget(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              {committeeTarget?.isClassCommittee ? '取消班委？' : '设为班委？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {committeeTarget?.isClassCommittee ? (
                <>
                  将取消 <strong>{committeeTarget?.nickname}</strong> 的班委身份，TA
                  将无法再发起点名或审批小组申请。
                </>
              ) : (
                <>
                  将授予 <strong>{committeeTarget?.nickname}</strong> 班委身份（
                  {committeeTarget?.classShortName}）：可发起点名、勾选到点、审批本班小组的加入申请。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (committeeTarget) {
                  setCommittee.mutate({
                    sid: committeeTarget.sid,
                    isClassCommittee: !committeeTarget.isClassCommittee,
                  })
                }
                setCommitteeTarget(null)
              }}
            >
              确定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote / demote confirmation */}
      <AlertDialog open={roleTarget != null} onOpenChange={(o) => (!o ? setRoleTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              {roleTarget?.role === 'admin' ? '取消管理员？' : '设为管理员？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleTarget?.role === 'admin' ? (
                <>
                  将取消 <strong>{roleTarget?.nickname}</strong> 的管理员权限，TA 将无法再进入管理后台。
                </>
              ) : (
                <>
                  将授予 <strong>{roleTarget?.nickname}</strong> 管理员权限：可查看所有用户、重置普通用户密码、
                  导入用户、管理所有资料。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Body({
  isPending,
  isError,
  message,
  onRetry,
  children,
}: {
  isPending: boolean
  isError: boolean
  message?: string | undefined
  onRetry: () => void
  children: React.ReactNode
}) {
  if (isPending) return <LoadingSkeleton preset="list" count={8} />
  if (isError) return <ErrorState title="加载用户失败" message={message ?? ''} onRetry={onRetry} />
  return <>{children}</>
}
