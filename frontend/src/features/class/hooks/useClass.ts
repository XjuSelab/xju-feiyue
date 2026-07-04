import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { deleteAdminUser } from '@/api/endpoints/admin'
import { getClassMe, listClassMembers, setMemberCommittee } from '@/api/endpoints/classes'
import type { ClassMe, ClassMember } from '@/api/schemas/class'
import { classKeys, errMsg } from './keys'

const STALE_MS = 60_000

/** 我的班级卡片（未分配班级时字段为 null —— 页面渲染空态，不是错误）。 */
export function useClassMe(): UseQueryResult<ClassMe> {
  return useQuery({
    queryKey: classKeys.me,
    queryFn: getClassMe,
    staleTime: STALE_MS,
  })
}

/** 全班同学（成员 tab + 点名名单头像用）。`enabled` 由入班状态门控。 */
export function useClassMembers(enabled: boolean): UseQueryResult<ClassMember[]> {
  return useQuery({
    queryKey: classKeys.members,
    queryFn: listClassMembers,
    enabled,
    staleTime: STALE_MS,
  })
}

/** 班内设置班委（成员右键）—— 超管任意；班长可设普通班委。 */
export function useSetMemberCommittee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      sid,
      isClassCommittee,
      committeeTitle,
    }: {
      sid: string
      isClassCommittee: boolean
      committeeTitle?: string | undefined
    }) => setMemberCommittee(sid, isClassCommittee, committeeTitle),
    onSuccess: (member) => {
      void qc.invalidateQueries({ queryKey: classKeys.members })
      // 自己的班委状态也可能变（页头徽标）。
      void qc.invalidateQueries({ queryKey: classKeys.me })
      toast.success(
        member.isClassCommittee
          ? `已将 ${member.nickname} 设为${member.committeeTitle ?? '班委'}`
          : `已取消 ${member.nickname} 的班委`,
      )
    },
    onError: (e) => toast.error(errMsg(e, '设置班委失败')),
  })
}

/** 删除账户（硬删，超管专属）—— 班级空间成员右键入口。 */
export function useDeleteMemberAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sid }: { sid: string; nickname: string }) => deleteAdminUser(sid),
    onSuccess: (_data, vars) => {
      // 成员/点名/小组/未进组全都可能受级联影响，整域对账。
      void qc.invalidateQueries({ queryKey: classKeys.all })
      toast.success(`已删除 ${vars.nickname} 的账户`)
    },
    onError: (e) => toast.error(errMsg(e, '删除账户失败')),
  })
}
