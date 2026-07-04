import { request } from '../client'
import {
  ClassMemberListSchema,
  ClassMeSchema,
  RollcallDetailSchema,
  RollcallListSchema,
  RollcallRecordSchema,
  RollcallSummarySchema,
  type ClassMe,
  type ClassMember,
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

/** 暴露 authHeaders 供同 feature 的 groups.ts 复用同一约定。 */
export { authHeaders as classAuthHeaders }
