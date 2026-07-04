import { getApiBase, isMockMode, request } from '../client'
import { xhrUpload, type UploadProgress } from '../upload'
import {
  ClassMemberListSchema,
  GroupDetailSchema,
  GroupFileListSchema,
  GroupListSchema,
  GroupSchema,
  GroupTaskListSchema,
  GroupTaskSchema,
  JoinRequestListSchema,
  JoinRequestSchema,
  type ClassMember,
  type Group,
  type GroupCreateIn,
  type GroupDetail,
  type GroupFile,
  type GroupTask,
  type GroupUpdateIn,
  type JoinRequest,
  type TaskCreateIn,
  type TaskUpdateIn,
} from '../schemas/class'
import { NoContentSchema } from '../schemas/material'
import { classAuthHeaders as authHeaders } from './classes'

/**
 * /groups/* 端点封装 —— 小组生命周期、申请加入、组内空间（文件 + 甘特任务）。
 *
 * 权限阶梯（后端强制，前端只做展示裁剪）：本班成员可见卡片/详情；
 * 组员（或班委/管理员）可进组内空间；组长（或班委/管理员）可改元数据、
 * 审批、移除成员。文件上传镜像 materials：mock 模式退回 request，
 * 真实模式走 xhrUpload 出逐字节进度。
 */

// ---------------------------------------------------------------------------
// 小组生命周期
// ---------------------------------------------------------------------------

/** GET /classes/me/groups —— 本班全部小组（含观察者视角字段）。 */
export async function listGroups(): Promise<Group[]> {
  return request({
    method: 'GET',
    path: '/classes/me/groups',
    schema: GroupListSchema,
    headers: authHeaders(),
  })
}

/** GET /classes/me/groups/unassigned —— 未进组同学名单（小组 tab 底部）。 */
export async function listUnassignedMembers(): Promise<ClassMember[]> {
  return request({
    method: 'GET',
    path: '/classes/me/groups/unassigned',
    schema: ClassMemberListSchema,
    headers: authHeaders(),
  })
}

/** POST /classes/me/groups —— 建组（创建者即组长；一人一组，409）。 */
export async function createGroup(body: GroupCreateIn): Promise<Group> {
  return request({
    method: 'POST',
    path: '/classes/me/groups',
    schema: GroupSchema,
    headers: authHeaders(),
    body,
  })
}

/** GET /groups/{gid} —— 小组详情（成员列表 + 待审数），本班可见。 */
export async function getGroup(gid: string): Promise<GroupDetail> {
  return request({
    method: 'GET',
    path: `/groups/${gid}`,
    schema: GroupDetailSchema,
    headers: authHeaders(),
  })
}

/** PATCH /groups/{gid} —— 改名/改简介（组长/班委）。 */
export async function updateGroup(gid: string, body: GroupUpdateIn): Promise<GroupDetail> {
  return request({
    method: 'PATCH',
    path: `/groups/${gid}`,
    schema: GroupDetailSchema,
    headers: authHeaders(),
    body,
  })
}

/** POST /groups/{gid}/logo —— 上传小组 Logo（≤2MB 图片，组长/班委）。 */
export async function uploadGroupLogo(gid: string, file: File): Promise<GroupDetail> {
  const form = new FormData()
  form.append('file', file)
  return request({
    method: 'POST',
    path: `/groups/${gid}/logo`,
    schema: GroupDetailSchema,
    headers: authHeaders(),
    body: form,
  })
}

/** DELETE /groups/{gid} —— 解散小组（组长/班委，204；软删+清文件）。 */
export async function deleteGroup(gid: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/groups/${gid}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

// ---------------------------------------------------------------------------
// 申请加入
// ---------------------------------------------------------------------------

/** POST /groups/{gid}/join-requests —— 申请加入（一组一条 pending）。 */
export async function createJoinRequest(gid: string, message?: string): Promise<JoinRequest> {
  return request({
    method: 'POST',
    path: `/groups/${gid}/join-requests`,
    schema: JoinRequestSchema,
    headers: authHeaders(),
    body: message ? { message } : {},
  })
}

/** GET /groups/{gid}/join-requests?status= —— 审批队列（组长/班委）。 */
export async function listJoinRequests(
  gid: string,
  status?: 'pending' | 'approved' | 'rejected',
): Promise<JoinRequest[]> {
  return request({
    method: 'GET',
    path: `/groups/${gid}/join-requests`,
    schema: JoinRequestListSchema,
    headers: authHeaders(),
    query: status ? { status } : {},
  })
}

/** POST …/approve —— 通过（加成员 + 自动拒其它 pending；已入他组 409）。 */
export async function approveJoinRequest(gid: string, reqId: string): Promise<JoinRequest> {
  return request({
    method: 'POST',
    path: `/groups/${gid}/join-requests/${reqId}/approve`,
    schema: JoinRequestSchema,
    headers: authHeaders(),
  })
}

/** POST …/reject —— 拒绝。 */
export async function rejectJoinRequest(gid: string, reqId: string): Promise<JoinRequest> {
  return request({
    method: 'POST',
    path: `/groups/${gid}/join-requests/${reqId}/reject`,
    schema: JoinRequestSchema,
    headers: authHeaders(),
  })
}

/** DELETE /groups/{gid}/join-requests/{reqId} —— 申请人撤回自己的 pending。 */
export async function cancelJoinRequest(gid: string, reqId: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/groups/${gid}/join-requests/${reqId}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

// ---------------------------------------------------------------------------
// 成员
// ---------------------------------------------------------------------------

/** DELETE /groups/{gid}/members/{sid} —— 退出（本人）/ 移除（组长/班委）。 */
export async function removeGroupMember(gid: string, sid: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/groups/${gid}/members/${sid}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

/** POST /groups/{gid}/transfer-leader —— 转让组长（目标须已是组员）。 */
export async function transferLeader(gid: string, sid: string): Promise<GroupDetail> {
  return request({
    method: 'POST',
    path: `/groups/${gid}/transfer-leader`,
    schema: GroupDetailSchema,
    headers: authHeaders(),
    body: { sid },
  })
}

// ---------------------------------------------------------------------------
// 组内文件
// ---------------------------------------------------------------------------

/** GET /groups/{gid}/files —— 组内文件（组员/班委）。 */
export async function listGroupFiles(gid: string): Promise<GroupFile[]> {
  return request({
    method: 'GET',
    path: `/groups/${gid}/files`,
    schema: GroupFileListSchema,
    headers: authHeaders(),
  })
}

/**
 * POST /groups/{gid}/files —— 多文件 multipart 上传（组员），返回刷新后的
 * 完整列表。`onProgress` 传入即用 XHR 出**真实逐字节进度**（materials 同款）；
 * mock 模式退回 `request`。
 */
export async function uploadGroupFiles(
  gid: string,
  files: File[],
  onProgress?: (p: UploadProgress) => void,
): Promise<GroupFile[]> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  if (isMockMode()) {
    return request({
      method: 'POST',
      path: `/groups/${gid}/files`,
      schema: GroupFileListSchema,
      headers: authHeaders(),
      body: form,
    })
  }
  return xhrUpload({
    url: groupUploadUrl(gid),
    form,
    headers: authHeaders(),
    schema: GroupFileListSchema,
    onProgress,
  })
}

/** DELETE /groups/{gid}/files/{fileId} —— 删除（上传者/组长/班委，204）。 */
export async function deleteGroupFile(gid: string, fileId: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/groups/${gid}/files/${fileId}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

/** 下载端点绝对 URL（attachment + nosniff 由后端响应头保证）。 */
export function groupFileDownloadUrl(gid: string, fileId: string): string {
  return `${getApiBase()}/groups/${gid}/files/${fileId}/download`
}

/** 上传端点绝对 URL（供 xhrUpload 使用）。 */
export function groupUploadUrl(gid: string): string {
  return `${getApiBase()}/groups/${gid}/files`
}

// ---------------------------------------------------------------------------
// 甘特任务
// ---------------------------------------------------------------------------

/** GET /groups/{gid}/tasks —— 全部任务（按 startDate 升序）。 */
export async function listGroupTasks(gid: string): Promise<GroupTask[]> {
  return request({
    method: 'GET',
    path: `/groups/${gid}/tasks`,
    schema: GroupTaskListSchema,
    headers: authHeaders(),
  })
}

/** POST /groups/{gid}/tasks —— 建任务（组员；负责人须 ⊆ 组员）。 */
export async function createGroupTask(gid: string, body: TaskCreateIn): Promise<GroupTask> {
  return request({
    method: 'POST',
    path: `/groups/${gid}/tasks`,
    schema: GroupTaskSchema,
    headers: authHeaders(),
    body,
  })
}

/** PATCH /groups/{gid}/tasks/{tid} —— 部分更新；assigneeSids 全量替换。 */
export async function updateGroupTask(
  gid: string,
  tid: string,
  body: TaskUpdateIn,
): Promise<GroupTask> {
  return request({
    method: 'PATCH',
    path: `/groups/${gid}/tasks/${tid}`,
    schema: GroupTaskSchema,
    headers: authHeaders(),
    body,
  })
}

/** DELETE /groups/{gid}/tasks/{tid} —— 删任务（创建者/组长/班委，204）。 */
export async function deleteGroupTask(gid: string, tid: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/groups/${gid}/tasks/${tid}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}
