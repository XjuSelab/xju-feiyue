import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createAdminClass,
  createAdminUser,
  getAdminStats,
  listAdminClasses,
  listAdminUsers,
  listLoginEvents,
  resetUserPassword,
  setUserClass,
  setUserCommittee,
  setUserRole,
} from '@/api/endpoints/admin'
import type {
  AdminClass,
  AdminClassCreate,
  AdminStats,
  AdminUserRow,
  AssignableRole,
  LoginEvent,
  UserCreate,
} from '@/api/schemas/admin'

/**
 * React Query wrappers for the hidden /admin dashboard. Toasts live in the
 * hook layer (onSuccess/onError) — never in a Dialog's render (MEMORY: sonner
 * is sensitive to strict-mode + HMR). Writes invalidate both the users list
 * and the stats so counts/role badges refresh.
 *
 * query keys: ['admin','users'] / ['admin','stats'].
 */

const keys = {
  all: ['admin'] as const,
  users: ['admin', 'users'] as const,
  stats: ['admin', 'stats'] as const,
  logins: ['admin', 'logins'] as const,
  classes: ['admin', 'classes'] as const,
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

export function useAdminUsers(): UseQueryResult<AdminUserRow[]> {
  return useQuery({ queryKey: keys.users, queryFn: listAdminUsers })
}

export function useAdminStats(): UseQueryResult<AdminStats> {
  return useQuery({ queryKey: keys.stats, queryFn: getAdminStats })
}

export function useLoginEvents(limit = 12): UseQueryResult<LoginEvent[]> {
  return useQuery({ queryKey: [...keys.logins, limit], queryFn: () => listLoginEvents(limit) })
}

function useInvalidateAdmin() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: keys.users })
    void qc.invalidateQueries({ queryKey: keys.stats })
  }
}

export function useCreateUser() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: (body: UserCreate) => createAdminUser(body),
    onSuccess: (row) => {
      invalidate()
      toast.success(`已导入用户 ${row.nickname}（${row.sid}）`)
    },
    onError: (e) => toast.error(errMsg(e, '导入用户失败')),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ sid, password }: { sid: string; password?: string }) =>
      resetUserPassword(sid, password),
    // No toast here — the caller surfaces the new password in a dialog so the
    // admin can copy it (a toast would vanish too fast for that).
    onError: (e) => toast.error(errMsg(e, '重置密码失败')),
  })
}

export function useSetRole() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: ({ sid, role }: { sid: string; role: AssignableRole }) =>
      setUserRole(sid, role),
    onSuccess: (row) => {
      invalidate()
      toast.success(
        row.role === 'admin' ? `已将 ${row.nickname} 设为管理员` : `已取消 ${row.nickname} 的管理员`,
      )
    },
    onError: (e) => toast.error(errMsg(e, '修改角色失败')),
  })
}

// ---------------------------------------------------------------------------
// 班级管理
// ---------------------------------------------------------------------------

export function useAdminClasses(enabled = true): UseQueryResult<AdminClass[]> {
  return useQuery({ queryKey: keys.classes, queryFn: listAdminClasses, enabled })
}

export function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AdminClassCreate) => createAdminClass(body),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: keys.classes })
      toast.success(`已创建班级 ${row.shortName}`)
    },
    onError: (e) => toast.error(errMsg(e, '创建班级失败')),
  })
}

export function useSetUserClass() {
  const qc = useQueryClient()
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: ({ sid, classId }: { sid: string; classId: number | null }) =>
      setUserClass(sid, classId),
    onSuccess: (row) => {
      invalidate()
      void qc.invalidateQueries({ queryKey: keys.classes })
      toast.success(
        row.classShortName
          ? `已将 ${row.nickname} 加入 ${row.classShortName}`
          : `已移除 ${row.nickname} 的班级`,
      )
    },
    onError: (e) => toast.error(errMsg(e, '设置班级失败')),
  })
}

export function useSetUserCommittee() {
  const qc = useQueryClient()
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: ({ sid, isClassCommittee }: { sid: string; isClassCommittee: boolean }) =>
      setUserCommittee(sid, isClassCommittee),
    onSuccess: (row) => {
      invalidate()
      void qc.invalidateQueries({ queryKey: keys.classes })
      toast.success(
        row.isClassCommittee ? `已将 ${row.nickname} 设为班委` : `已取消 ${row.nickname} 的班委`,
      )
    },
    onError: (e) => toast.error(errMsg(e, '设置班委失败')),
  })
}

export { keys as adminKeys }
