import { ApiError, getApiBase, isMockMode, request } from '../client'
import {
  ClassMemberListSchema,
  ClassMemberSchema,
  ClassMeSchema,
  MissionListSchema,
  MissionSchema,
  RollcallDetailSchema,
  RollcallListSchema,
  RollcallRecordSchema,
  RollcallSummarySchema,
  type ClassMe,
  type ClassMember,
  type Mission,
  type MissionCreateIn,
  type MissionUpdateIn,
  type RollcallDetail,
  type RollcallRecord,
  type RollcallSummary,
} from '../schemas/class'
import { NoContentSchema } from '../schemas/material'

/**
 * /classes/me/* 端点封装 —— 班级空间（班级信息 / 成员 / 点名）。
 *
 * 班级作用域永远从 JWT 用户的 class_id 推导（路径里没有班级 id），
 * 跨班访问在构造上不可表达。读需要班级成员身份；点名写操作需要
 * 班委（或站点管理员兜底）。
 */

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** GET /classes/me —— 我的班级卡片；未分配班级时字段为 null（200）。 */
export async function getClassMe(): Promise<ClassMe> {
  return request({
    method: 'GET',
    path: '/classes/me',
    schema: ClassMeSchema,
    headers: authHeaders(),
  })
}

/** GET /classes/me/members —— 全班同学（按学号排序）。 */
export async function listClassMembers(): Promise<ClassMember[]> {
  return request({
    method: 'GET',
    path: '/classes/me/members',
    schema: ClassMemberListSchema,
    headers: authHeaders(),
  })
}

// ---------------------------------------------------------------------------
// 点名
// ---------------------------------------------------------------------------

/** POST /classes/me/rollcalls —— 发起点名（班委）；快照全员 present=false。 */
export async function createRollcall(title?: string): Promise<RollcallDetail> {
  return request({
    method: 'POST',
    path: '/classes/me/rollcalls',
    schema: RollcallDetailSchema,
    headers: authHeaders(),
    body: title ? { title } : {},
  })
}

/** GET /classes/me/rollcalls —— 历史摘要（新→旧），全班可见。 */
export async function listRollcalls(limit = 20, offset = 0): Promise<RollcallSummary[]> {
  return request({
    method: 'GET',
    path: '/classes/me/rollcalls',
    schema: RollcallListSchema,
    headers: authHeaders(),
    query: { limit, offset },
  })
}

/** GET /classes/me/rollcalls/{id} —— 摘要 + 全员勾选名单。 */
export async function getRollcall(id: string): Promise<RollcallDetail> {
  return request({
    method: 'GET',
    path: `/classes/me/rollcalls/${id}`,
    schema: RollcallDetailSchema,
    headers: authHeaders(),
  })
}

/**
 * PUT /classes/me/rollcalls/{id}/records/{sid} —— 单条勾选 upsert（班委）。
 * 每次点击一条小事务；两个班委并发勾选互不覆盖。
 */
export async function setRollcallRecord(
  id: string,
  sid: string,
  present: boolean,
): Promise<RollcallRecord> {
  return request({
    method: 'PUT',
    path: `/classes/me/rollcalls/${id}/records/${sid}`,
    schema: RollcallRecordSchema,
    headers: authHeaders(),
    body: { present },
  })
}

/** PATCH /classes/me/rollcalls/{id} —— 完成/重开/改名（班委）。 */
export async function updateRollcall(
  id: string,
  body: { title?: string; closed?: boolean },
): Promise<RollcallSummary> {
  return request({
    method: 'PATCH',
    path: `/classes/me/rollcalls/${id}`,
    schema: RollcallSummarySchema,
    headers: authHeaders(),
    body,
  })
}

/** DELETE /classes/me/rollcalls/{id} —— 删除点名（班委，204；记录级联）。 */
export async function deleteRollcall(id: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/classes/me/rollcalls/${id}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

/**
 * POST /classes/me/members/{sid}/committee —— 班内设置班委（成员右键入口）。
 * 权限：超管任意；班长可设普通班委（「班长」职务与现任班长仅超管可动）。
 */
export async function setMemberCommittee(
  sid: string,
  isClassCommittee: boolean,
  committeeTitle?: string,
): Promise<ClassMember> {
  return request({
    method: 'POST',
    path: `/classes/me/members/${sid}/committee`,
    schema: ClassMemberSchema,
    headers: authHeaders(),
    body: committeeTitle ? { isClassCommittee, committeeTitle } : { isClassCommittee },
  })
}

// ---------------------------------------------------------------------------
// 分组任务（mission）—— /class 顶层
// ---------------------------------------------------------------------------

/** GET /classes/me/missions —— 班级分组任务（进行中优先），全班可见。 */
export async function listMissions(): Promise<Mission[]> {
  return request({
    method: 'GET',
    path: '/classes/me/missions',
    schema: MissionListSchema,
    headers: authHeaders(),
  })
}

/** POST /classes/me/missions —— 新建分组任务（班委）；默认设为进行中。 */
export async function createMission(body: MissionCreateIn): Promise<Mission> {
  return request({
    method: 'POST',
    path: '/classes/me/missions',
    schema: MissionSchema,
    headers: authHeaders(),
    body,
  })
}

/** PATCH /classes/me/missions/{id} —— 改标题/描述、设为进行中（班委）。 */
export async function updateMission(id: string, body: MissionUpdateIn): Promise<Mission> {
  return request({
    method: 'PATCH',
    path: `/classes/me/missions/${id}`,
    schema: MissionSchema,
    headers: authHeaders(),
    body,
  })
}

/** DELETE /classes/me/missions/{id} —— 删除分组任务（班委，204）。 */
export async function deleteMission(id: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/classes/me/missions/${id}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

// ---------------------------------------------------------------------------
// 导出班级分组信息（.docx）
// ---------------------------------------------------------------------------

/** 从 Content-Disposition 解析文件名（优先 RFC 5987 filename*）。 */
function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1])
    } catch {
      /* fall through to plain filename */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1] ?? fallback
}

/**
 * GET /classes/me/groups/export —— 下载班级分组信息 .docx（班委）。
 *
 * 走裸 fetch（不经 `request`，因它只解 JSON），返回二进制 blob + 文件名。
 * mock 模式下返回一个占位文本 blob，让演示环境按钮也可用。
 */
export async function exportClassGroups(): Promise<{ blob: Blob; filename: string }> {
  if (isMockMode()) {
    return {
      blob: new Blob(['（演示环境占位：真实后端会导出 .docx）'], { type: 'text/plain' }),
      filename: '班级分组信息（演示）.txt',
    }
  }
  const url = new URL(`${getApiBase()}/classes/me/groups/export`, window.location.origin)
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: unknown } | null
      if (body && typeof body.detail === 'string' && body.detail.length > 0) {
        message = body.detail
      }
    } catch {
      /* keep HTTP fallback */
    }
    throw new ApiError(message, res.status, '/classes/me/groups/export')
  }
  const blob = await res.blob()
  const filename = filenameFromDisposition(
    res.headers.get('Content-Disposition'),
    '班级分组信息.docx',
  )
  return { blob, filename }
}

/** 触发浏览器下载一个 blob —— 造临时 <a download> 并点击。 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

/** 暴露 authHeaders 供同 feature 的 groups.ts 复用同一约定。 */
export { authHeaders as classAuthHeaders }
