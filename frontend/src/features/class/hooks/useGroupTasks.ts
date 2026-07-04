import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { createGroupTask, deleteGroupTask, listGroupTasks, updateGroupTask } from '@/api/endpoints/groups'
import type { GroupTask, TaskCreateIn, TaskUpdateIn } from '@/api/schemas/class'
import { classKeys, errMsg } from './keys'

/**
 * 甘特任务 hooks。`useUpdateTask` 是乐观的（仿 materials useReorder）：
 * 拖拽平移任务条要即时生效，等 round-trip 会有 ~1s 的橡皮筋回弹感。
 */

export function useGroupTasks(gid: string, enabled: boolean): UseQueryResult<GroupTask[]> {
  return useQuery({
    queryKey: classKeys.tasks(gid),
    queryFn: () => listGroupTasks(gid),
    enabled,
  })
}

export function useCreateTask(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TaskCreateIn) => createGroupTask(gid, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.tasks(gid) })
      toast.success('任务已创建')
    },
    onError: (e) => toast.error(errMsg(e, '创建任务失败')),
  })
}

/** 乐观部分更新：onMutate 就地补丁缓存，onError 回滚，onSettled 对账。 */
export function useUpdateTask(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tid, body }: { tid: string; body: TaskUpdateIn }) =>
      updateGroupTask(gid, tid, body),
    onMutate: async ({ tid, body }) => {
      await qc.cancelQueries({ queryKey: classKeys.tasks(gid) })
      const prev = qc.getQueryData<GroupTask[]>(classKeys.tasks(gid))
      if (prev) {
        qc.setQueryData<GroupTask[]>(
          classKeys.tasks(gid),
          prev.map((t) => (t.id === tid ? ({ ...t, ...body } as GroupTask) : t)),
        )
      }
      return { prev }
    },
    onError: (e, _vars, context) => {
      if (context?.prev !== undefined) {
        qc.setQueryData(classKeys.tasks(gid), context.prev)
      }
      toast.error(errMsg(e, '更新任务失败'))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: classKeys.tasks(gid) })
    },
  })
}

export function useDeleteTask(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tid: string) => deleteGroupTask(gid, tid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.tasks(gid) })
      toast.success('任务已删除')
    },
    onError: (e) => toast.error(errMsg(e, '删除任务失败')),
  })
}
