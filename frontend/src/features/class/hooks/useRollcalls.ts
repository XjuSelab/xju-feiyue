import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createRollcall,
  deleteRollcall,
  getRollcall,
  listRollcalls,
  setRollcallRecord,
  updateRollcall,
} from '@/api/endpoints/classes'
import type { RollcallDetail, RollcallSummary } from '@/api/schemas/class'
import { classKeys, errMsg } from './keys'

/**
 * 点名 hooks —— toast 一律在 hook 层（useMaterials 教条）。
 *
 * 勾选（useSetRollcallRecord）是并发敏感路径：每个 checkbox 点击一条
 * PUT，乐观翻转单条记录 + 重算 presentCount；`mutationKey` 统一为
 * ['rollcall-record', id]，onSettled 里只有当自己是**最后一个在途**记录
 * mutation 时才 invalidate —— 否则先返回的请求会触发 refetch，把后点的
 * checkbox 的乐观值踩掉（标准并发乐观更新模式）。
 */

export function useRollcalls(enabled: boolean): UseQueryResult<RollcallSummary[]> {
  return useQuery({
    queryKey: classKeys.rollcalls,
    queryFn: () => listRollcalls(),
    enabled,
  })
}

export function useRollcall(id: string | null): UseQueryResult<RollcallDetail> {
  return useQuery({
    queryKey: classKeys.rollcall(id ?? '__none__'),
    queryFn: () => getRollcall(id as string),
    enabled: id != null,
  })
}

/** 发起点名（班委）：成功即把详情写入缓存，调用方切到点名视图。 */
export function useStartRollcall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title?: string) => createRollcall(title),
    onSuccess: (detail) => {
      qc.setQueryData<RollcallDetail>(classKeys.rollcall(detail.id), detail)
      void qc.invalidateQueries({ queryKey: classKeys.rollcalls })
      toast.success('点名已发起')
    },
    onError: (e) => toast.error(errMsg(e, '发起点名失败')),
  })
}

/** 单条勾选 —— 乐观翻转 + 最后在途者才 invalidate。 */
export function useSetRollcallRecord(id: string) {
  const qc = useQueryClient()
  const mutationKey = ['rollcall-record', id] as const
  return useMutation({
    mutationKey,
    mutationFn: ({ sid, present }: { sid: string; present: boolean }) =>
      setRollcallRecord(id, sid, present),
    onMutate: async ({ sid, present }) => {
      await qc.cancelQueries({ queryKey: classKeys.rollcall(id) })
      const prev = qc.getQueryData<RollcallDetail>(classKeys.rollcall(id))
      if (prev) {
        const records = prev.records.map((r) => (r.sid === sid ? { ...r, present } : r))
        qc.setQueryData<RollcallDetail>(classKeys.rollcall(id), {
          ...prev,
          records,
          presentCount: records.filter((r) => r.present).length,
        })
      }
      return { prev }
    },
    onError: (e, _vars, context) => {
      if (context?.prev !== undefined) {
        qc.setQueryData(classKeys.rollcall(id), context.prev)
      }
      toast.error(errMsg(e, '勾选失败'))
    },
    onSettled: () => {
      // 只有最后一个在途记录 mutation 负责对账，避免早返回的 refetch
      // 覆盖后点 checkbox 的乐观值。
      if (qc.isMutating({ mutationKey }) === 1) {
        void qc.invalidateQueries({ queryKey: classKeys.rollcall(id) })
        void qc.invalidateQueries({ queryKey: classKeys.rollcalls })
      }
    },
  })
}

/** 完成 / 重开点名。 */
export function useCloseRollcall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, closed }: { id: string; closed: boolean }) =>
      updateRollcall(id, { closed }),
    onSuccess: (summary, vars) => {
      void qc.invalidateQueries({ queryKey: classKeys.rollcall(vars.id) })
      void qc.invalidateQueries({ queryKey: classKeys.rollcalls })
      if (vars.closed) {
        toast.success(`点名已保存 · 出勤 ${summary.presentCount}/${summary.totalCount}`)
      }
    },
    onError: (e) => toast.error(errMsg(e, '保存点名失败')),
  })
}

/** 删除一次点名（班委，历史行内操作）。 */
export function useDeleteRollcall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRollcall(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.rollcalls })
      toast.success('点名已删除')
    },
    onError: (e) => toast.error(errMsg(e, '删除点名失败')),
  })
}
