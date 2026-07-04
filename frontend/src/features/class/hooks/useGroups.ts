import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  approveJoinRequest,
  cancelJoinRequest,
  createGroup,
  createJoinRequest,
  deleteGroup,
  getGroup,
  listGroups,
  listJoinRequests,
  listUnassignedMembers,
  rejectJoinRequest,
  removeGroupMember,
  transferLeader,
  updateGroup,
  uploadGroupLogo,
} from '@/api/endpoints/groups'
import type {
  ClassMember,
  Group,
  GroupCreateIn,
  GroupDetail,
  GroupUpdateIn,
  JoinRequest,
} from '@/api/schemas/class'
import { classKeys, errMsg } from './keys'

/** 小组生命周期 + 申请加入 hooks —— toast 全在 hook 层。 */

export function useGroups(enabled: boolean): UseQueryResult<Group[]> {
  return useQuery({
    queryKey: classKeys.groups,
    queryFn: listGroups,
    enabled,
  })
}

/** 未进组同学名单（小组 tab 底部）。key 以 classKeys.groups 为前缀，
 * 任何小组变动的 invalidate 都会连带刷新。 */
export function useUnassignedMembers(enabled: boolean): UseQueryResult<ClassMember[]> {
  return useQuery({
    queryKey: [...classKeys.groups, 'unassigned'],
    queryFn: listUnassignedMembers,
    enabled,
  })
}

export function useGroup(gid: string | null): UseQueryResult<GroupDetail> {
  return useQuery({
    queryKey: classKeys.group(gid ?? '__none__'),
    queryFn: () => getGroup(gid as string),
    enabled: gid != null,
  })
}

export function useJoinRequests(gid: string, enabled: boolean): UseQueryResult<JoinRequest[]> {
  return useQuery({
    queryKey: classKeys.joinRequests(gid),
    queryFn: () => listJoinRequests(gid, 'pending'),
    enabled,
  })
}

/** 建组（创建者即组长）；可选顺带传 logo（建组后链式上传）。 */
export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ body, logo }: { body: GroupCreateIn; logo?: File | null }) => {
      const group = await createGroup(body)
      if (logo) await uploadGroupLogo(group.id, logo)
      return group
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.groups })
      toast.success('小组已创建，你已成为组长')
    },
    onError: (e) => toast.error(errMsg(e, '创建小组失败')),
  })
}

export function useUpdateGroup(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: GroupUpdateIn) => updateGroup(gid, body),
    onSuccess: (detail) => {
      qc.setQueryData<GroupDetail>(classKeys.group(gid), detail)
      void qc.invalidateQueries({ queryKey: classKeys.groups })
      toast.success('小组信息已更新')
    },
    onError: (e) => toast.error(errMsg(e, '更新小组失败')),
  })
}

export function useUploadGroupLogo(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadGroupLogo(gid, file),
    onSuccess: (detail) => {
      qc.setQueryData<GroupDetail>(classKeys.group(gid), detail)
      void qc.invalidateQueries({ queryKey: classKeys.groups })
      toast.success('小组 Logo 已更新')
    },
    onError: (e) => toast.error(errMsg(e, '上传 Logo 失败')),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gid: string) => deleteGroup(gid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.groups })
      toast.success('小组已解散')
    },
    onError: (e) => toast.error(errMsg(e, '解散小组失败')),
  })
}

// ---------------------------------------------------------------------------
// 申请加入
// ---------------------------------------------------------------------------

function invalidateGroupAndList(qc: ReturnType<typeof useQueryClient>, gid: string) {
  void qc.invalidateQueries({ queryKey: classKeys.group(gid) })
  void qc.invalidateQueries({ queryKey: classKeys.joinRequests(gid) })
  void qc.invalidateQueries({ queryKey: classKeys.groups })
}

export function useApplyToGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ gid, message }: { gid: string; message?: string }) =>
      createJoinRequest(gid, message),
    onSuccess: (_req, vars) => {
      invalidateGroupAndList(qc, vars.gid)
      toast.success('申请已提交，等待审核')
    },
    onError: (e) => toast.error(errMsg(e, '提交申请失败')),
  })
}

export function useCancelJoinRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ gid, reqId }: { gid: string; reqId: string }) =>
      cancelJoinRequest(gid, reqId),
    onSuccess: (_data, vars) => {
      invalidateGroupAndList(qc, vars.gid)
      toast.success('已撤回申请')
    },
    onError: (e) => toast.error(errMsg(e, '撤回申请失败')),
  })
}

export function useDecideJoinRequest(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reqId, approve }: { reqId: string; approve: boolean }) =>
      approve ? approveJoinRequest(gid, reqId) : rejectJoinRequest(gid, reqId),
    onSuccess: (req) => {
      invalidateGroupAndList(qc, gid)
      toast.success(req.status === 'approved' ? `已通过 ${req.nickname} 的申请` : '已拒绝该申请')
    },
    onError: (e) => toast.error(errMsg(e, '处理申请失败')),
  })
}

// ---------------------------------------------------------------------------
// 成员管理
// ---------------------------------------------------------------------------

export function useRemoveMember(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sid }: { sid: string; isSelf: boolean }) => removeGroupMember(gid, sid),
    onSuccess: (_data, vars) => {
      invalidateGroupAndList(qc, gid)
      toast.success(vars.isSelf ? '已退出小组' : '已移除该成员')
    },
    onError: (e) => toast.error(errMsg(e, '操作失败')),
  })
}

export function useTransferLeader(gid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sid: string) => transferLeader(gid, sid),
    onSuccess: (detail) => {
      qc.setQueryData<GroupDetail>(classKeys.group(gid), detail)
      void qc.invalidateQueries({ queryKey: classKeys.groups })
      toast.success('组长已转让')
    },
    onError: (e) => toast.error(errMsg(e, '转让组长失败')),
  })
}
