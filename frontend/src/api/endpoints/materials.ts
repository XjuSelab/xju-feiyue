import type { QueryValue } from '../client'
import { getApiBase, isMockMode, request } from '../client'
import { xhrUpload, type UploadProgress } from '../upload'
import {
  MaterialFileSchema,
  MaterialFileTreeSchema,
  MaterialNoticeSchema,
  MaterialResourceListSchema,
  MaterialResourceSchema,
  NoContentSchema,
  type MaterialFile,
  type MaterialNotice,
  type MaterialResource,
  type ReorderIn,
  type ResourceCreateIn,
  type ResourceUpdateIn,
} from '../schemas/material'

/**
 * /materials/* 端点封装 —— 共享课程资料知识库。
 *
 * 鉴权：写操作带 `Authorization: Bearer <token>`（TOKEN_KEY 与 schools.ts 一致，
 * `localStorage['labnotes.auth.token']`）；读操作（list/detail/files/download）后端是
 * 共享读，但仍带上 token（不影响匿名读，且让后端能识别 owner）。
 *
 * 所有响应过 zod schema（client.ts `request({ schema })`），边界处强校验；
 * 204 端点用 `NoContentSchema`(z.null)。
 */

const TOKEN_KEY = 'labnotes.auth.token'

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// ---------------------------------------------------------------------------
// 资源 CRUD
// ---------------------------------------------------------------------------

/** GET /materials/resources?q= —— 全部未删资源（共享知识库，无 owner 过滤）。 */
export async function listResources(q?: string): Promise<MaterialResource[]> {
  const query: Record<string, QueryValue> = {}
  if (q && q.trim()) query['q'] = q.trim()
  return request({
    method: 'GET',
    path: '/materials/resources',
    schema: MaterialResourceListSchema,
    headers: authHeaders(),
    query,
  })
}

/** GET /materials/resources/{rid} —— 资源详情 + 组好的文件树（共享读）。 */
export async function getResource(rid: string): Promise<MaterialResource> {
  return request({
    method: 'GET',
    path: `/materials/resources/${rid}`,
    schema: MaterialResourceSchema,
    headers: authHeaders(),
  })
}

/** POST /materials/resources —— 新建归属当前用户的资源（201）。 */
export async function createResource(body: ResourceCreateIn): Promise<MaterialResource> {
  return request({
    method: 'POST',
    path: '/materials/resources',
    schema: MaterialResourceSchema,
    headers: authHeaders(),
    body,
  })
}

/** PATCH /materials/resources/{rid} —— 更新资源元数据（owner only）。 */
export async function updateResource(
  rid: string,
  body: ResourceUpdateIn,
): Promise<MaterialResource> {
  return request({
    method: 'PATCH',
    path: `/materials/resources/${rid}`,
    schema: MaterialResourceSchema,
    headers: authHeaders(),
    body,
  })
}

/** DELETE /materials/resources/{rid} —— 软删资源 + 级联（owner only，204）。 */
export async function deleteResource(rid: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/materials/resources/${rid}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

// ---------------------------------------------------------------------------
// 文件树
// ---------------------------------------------------------------------------

/** GET /materials/resources/{rid}/files —— 组好的文件树（共享读）。 */
export async function getFiles(rid: string): Promise<MaterialFile[]> {
  return request({
    method: 'GET',
    path: `/materials/resources/${rid}/files`,
    schema: MaterialFileTreeSchema,
    headers: authHeaders(),
  })
}

/**
 * POST /materials/resources/{rid}/files —— 多文件 multipart 上传（owner only）。
 * 返回重新组好的树。`folderId` 省略 = 上传到资源根。
 *
 * `onProgress` 可选（向后兼容）：传入即用 XHR 出**真实逐字节进度**（多文件一次请求，
 * 进度是整体字节比）；省略时行为与原 fetch 路径一致。Mock 模式下退回 `request`。
 */
export async function uploadFiles(
  rid: string,
  files: File[],
  folderId?: string | null,
  onProgress?: (p: UploadProgress) => void,
): Promise<MaterialFile[]> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  if (isMockMode()) {
    const query: Record<string, QueryValue> = {}
    if (folderId) query['folderId'] = folderId
    return request({
      method: 'POST',
      path: `/materials/resources/${rid}/files`,
      schema: MaterialFileTreeSchema,
      headers: authHeaders(),
      body: form,
      query,
    })
  }
  // uploadUrl() 已把 folderId 编进 query string，直接整 URL 给 xhrUpload。
  return xhrUpload({
    url: uploadUrl(rid, folderId),
    form,
    headers: authHeaders(),
    schema: MaterialFileTreeSchema,
    onProgress,
  })
}

/** POST /materials/resources/{rid}/folders —— 建文件夹（owner only，201）。 */
export async function createFolder(
  rid: string,
  name: string,
  parentId?: string | null,
): Promise<MaterialFile> {
  return request({
    method: 'POST',
    path: `/materials/resources/${rid}/folders`,
    schema: MaterialFileSchema,
    headers: authHeaders(),
    body: { name, parentId: parentId ?? null },
  })
}

/** PATCH /materials/files/{fileId}/rename —— 重命名（owner only，强制保留扩展名）。 */
export async function renameFile(fileId: string, name: string): Promise<MaterialFile> {
  return request({
    method: 'PATCH',
    path: `/materials/files/${fileId}/rename`,
    schema: MaterialFileSchema,
    headers: authHeaders(),
    body: { name },
  })
}

/** POST /materials/files/reorder —— 拖拽 reorder（owner only，204；环路 400）。 */
export async function reorder(body: ReorderIn): Promise<null> {
  return request({
    method: 'POST',
    path: '/materials/files/reorder',
    schema: NoContentSchema,
    headers: authHeaders(),
    body,
  })
}

/** DELETE /materials/files/{fileId} —— 软删文件 + unlink（owner only，204）。 */
export async function deleteFile(fileId: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/materials/files/${fileId}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

/** DELETE /materials/folders/{folderId} —— 递归软删文件夹（owner only，204）。 */
export async function deleteFolder(folderId: string): Promise<null> {
  return request({
    method: 'DELETE',
    path: `/materials/folders/${folderId}`,
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

/**
 * 拼出 GET /materials/files/{fileId}/download 的绝对 URL（带 nosniff +
 * Content-Disposition: attachment 由后端响应头保证）。供 `<a download>` /
 * useDownload 的 fetch 使用。`getApiBase()` 在 prod 同源时为 ''。
 */
export function downloadUrl(fileId: string): string {
  return `${getApiBase()}/materials/files/${fileId}/download`
}

/** 上传端点的绝对 URL（供 useMaterials 的带进度原生 fetch 使用）。 */
export function uploadUrl(rid: string, folderId?: string | null): string {
  const base = `${getApiBase()}/materials/resources/${rid}/files`
  if (folderId) return `${base}?folderId=${encodeURIComponent(folderId)}`
  return base
}

// ---------------------------------------------------------------------------
// 致谢信息条
// ---------------------------------------------------------------------------

/** GET /materials/notice —— 致谢条（共享读；visible=false 表管理员已隐藏）。 */
export async function getNotice(): Promise<MaterialNotice> {
  return request({
    method: 'GET',
    path: '/materials/notice',
    schema: MaterialNoticeSchema,
    headers: authHeaders(),
  })
}

/** PUT /materials/notice —— 设置内容并显示（管理员 only）。 */
export async function putNotice(content: string): Promise<MaterialNotice> {
  return request({
    method: 'PUT',
    path: '/materials/notice',
    schema: MaterialNoticeSchema,
    headers: authHeaders(),
    body: { content },
  })
}

/** DELETE /materials/notice —— 隐藏致谢条（管理员 only，204；内容保留可恢复）。 */
export async function deleteNotice(): Promise<null> {
  return request({
    method: 'DELETE',
    path: '/materials/notice',
    schema: NoContentSchema,
    headers: authHeaders(),
  })
}

/** 暴露 authHeaders 供需要原生 fetch（带进度）的 hook 复用，避免重复实现。 */
export { authHeaders as materialsAuthHeaders }
