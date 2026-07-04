import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { getClassMe, listClassMembers } from '@/api/endpoints/classes'
import type { ClassMe, ClassMember } from '@/api/schemas/class'
import { classKeys } from './keys'

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
