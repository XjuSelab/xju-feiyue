import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createMission,
  deleteMission,
  exportClassGroups,
  listMissions,
  triggerBlobDownload,
  updateMission,
} from '@/api/endpoints/classes'
import type { Mission, MissionCreateIn, MissionUpdateIn } from '@/api/schemas/class'
import { classKeys, errMsg } from './keys'

const STALE_MS = 60_000

/**
 * 分组任务（mission）hooks —— /class 顶层任务层。
 * 列表按「进行中优先」返回；`useActiveMission` 派生进行中任务（无则 null）。
 * 写操作（建/改/设为进行中/删）仅班委可见，后端二次强制。toast 在 hook 层。
 */

export function useMissions(enabled: boolean): UseQueryResult<Mission[]> {
  return useQuery({
    queryKey: classKeys.missions,
    queryFn: listMissions,
    enabled,
    staleTime: STALE_MS,
  })
}

/** 进行中任务（列表里 isActive 的那个）；加载中 / 无任务时为 undefined/null。 */
export function activeMissionOf(missions: Mission[] | undefined): Mission | null {
  return missions?.find((m) => m.isActive) ?? null
}

export function useCreateMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: MissionCreateIn) => createMission(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.missions })
      toast.success('分组任务已创建')
    },
    onError: (e) => toast.error(errMsg(e, '创建分组任务失败')),
  })
}

export function useUpdateMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MissionUpdateIn }) => updateMission(id, body),
    onSuccess: (_m, vars) => {
      void qc.invalidateQueries({ queryKey: classKeys.missions })
      toast.success(vars.body.active ? '已设为进行中任务' : '分组任务已更新')
    },
    onError: (e) => toast.error(errMsg(e, '更新分组任务失败')),
  })
}

export function useDeleteMission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMission(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.missions })
      toast.success('分组任务已删除')
    },
    onError: (e) => toast.error(errMsg(e, '删除分组任务失败')),
  })
}

/** 导出班级分组信息 .docx —— 拉 blob 后触发浏览器下载（班委）。 */
export function useExportClassGroups() {
  return useMutation({
    mutationFn: exportClassGroups,
    onSuccess: ({ blob, filename }) => {
      triggerBlobDownload(blob, filename)
      toast.success('已导出班级分组信息')
    },
    onError: (e) => toast.error(errMsg(e, '导出失败')),
  })
}
