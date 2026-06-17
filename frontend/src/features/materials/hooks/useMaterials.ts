import { useCallback } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  createFolder,
  createResource,
  deleteFile,
  deleteFolder,
  deleteNotice,
  deleteResource,
  getFiles,
  getNotice,
  getResource,
  listResources,
  putNotice,
  renameFile,
  reorder,
  updateResource,
  uploadFiles,
} from '@/api/endpoints/materials'
import type { UploadProgress } from '@/api/upload'
import type { MaterialFile, MaterialResource } from '../types'
import type {
  MaterialNotice,
  ReorderIn,
  ResourceCreateIn,
  ResourceUpdateIn,
} from '@/api/schemas/material'
import { applyReorder } from '../lib/tree'

/**
 * @tanstack/react-query 封装「资料」域全部读写 —— **toast 一律在 hook 层调用**
 * （onSuccess / onError 回调里），绝不放在 Dialog 渲染期（MEMORY：sonner 对
 * strict-mode + HMR 敏感）。所有写操作成功后 invalidate 相关 query 重拉，保证
 * 列表/详情/文件树一致；reorder 跨请求并发也靠 invalidate 兜底（已知限制）。
 *
 * query key 约定：
 * - ['materials', 'resources', q]        资源列表
 * - ['materials', 'resource', rid]       资源详情（含树）
 * - ['materials', 'files', rid]          资源文件树
 */

const LIST_STALE_MS = 60_000

const keys = {
  all: ['materials'] as const,
  resources: (q?: string) => ['materials', 'resources', q ?? ''] as const,
  resource: (rid: string) => ['materials', 'resource', rid] as const,
  files: (rid: string) => ['materials', 'files', rid] as const,
  notice: ['materials', 'notice'] as const,
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

/** 资源列表（共享知识库，全部未删；可选 `q` 搜索）。 */
export function useResources(q?: string): UseQueryResult<MaterialResource[]> {
  return useQuery({
    queryKey: keys.resources(q),
    queryFn: () => listResources(q),
    placeholderData: (prev) => prev,
    staleTime: LIST_STALE_MS,
  })
}

/** 资源详情 + 组好的文件树。 */
export function useResource(rid: string | null): UseQueryResult<MaterialResource> {
  return useQuery({
    queryKey: keys.resource(rid ?? '__none__'),
    queryFn: () => getResource(rid as string),
    enabled: rid != null,
  })
}

/** 资源文件树（详情页 split-pane 左侧树单独取数，便于上传/reorder 后只刷树）。 */
export function useFiles(rid: string | null): UseQueryResult<MaterialFile[]> {
  return useQuery({
    queryKey: keys.files(rid ?? '__none__'),
    queryFn: () => getFiles(rid as string),
    enabled: rid != null,
  })
}

/** 致谢信息条（共享读；visible=false 表已隐藏）。 */
export function useNotice(): UseQueryResult<MaterialNotice> {
  return useQuery({
    queryKey: keys.notice,
    queryFn: getNotice,
    staleTime: LIST_STALE_MS,
  })
}

// ---------------------------------------------------------------------------
// 致谢信息条 mutations（管理员）
// ---------------------------------------------------------------------------

/** PUT 致谢内容（管理员）：新建 / 编辑 / 隐藏后恢复，成功即显示。 */
export function useUpdateNotice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => putNotice(content),
    onSuccess: (data) => {
      qc.setQueryData<MaterialNotice>(keys.notice, data)
      toast.success('致谢已更新')
    },
    onError: (e) => toast.error(errMsg(e, '保存致谢失败')),
  })
}

/** DELETE 致谢条（管理员）：软隐藏，内容保留可恢复。 */
export function useDeleteNotice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => deleteNotice(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.notice })
      toast.success('致谢已隐藏')
    },
    onError: (e) => toast.error(errMsg(e, '隐藏致谢失败')),
  })
}

// ---------------------------------------------------------------------------
// 资源 CRUD mutations
// ---------------------------------------------------------------------------

export function useCreateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ResourceCreateIn) => createResource(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['materials', 'resources'] })
      toast.success('资料已创建')
    },
    onError: (e) => toast.error(errMsg(e, '创建资料失败')),
  })
}

export function useUpdateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rid, body }: { rid: string; body: ResourceUpdateIn }) =>
      updateResource(rid, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['materials', 'resources'] })
      void qc.invalidateQueries({ queryKey: keys.resource(data.id) })
      toast.success('资料已更新')
    },
    onError: (e) => toast.error(errMsg(e, '更新资料失败')),
  })
}

export function useDeleteResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rid: string) => deleteResource(rid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['materials', 'resources'] })
      toast.success('资料已删除')
    },
    onError: (e) => toast.error(errMsg(e, '删除资料失败')),
  })
}

// ---------------------------------------------------------------------------
// 文件树 mutations
// ---------------------------------------------------------------------------

/** 失效某资源的详情 + 文件树（任意文件操作后调用）。 */
function useInvalidateTree() {
  const qc = useQueryClient()
  return useCallback(
    (rid: string) => {
      void qc.invalidateQueries({ queryKey: keys.files(rid) })
      void qc.invalidateQueries({ queryKey: keys.resource(rid) })
      // 列表的文件数 / 更新时间也会变。
      void qc.invalidateQueries({ queryKey: ['materials', 'resources'] })
    },
    [qc],
  )
}

export function useCreateFolder() {
  const invalidate = useInvalidateTree()
  return useMutation({
    mutationFn: ({
      rid,
      name,
      parentId,
    }: {
      rid: string
      name: string
      parentId?: string | null
    }) => createFolder(rid, name, parentId),
    onSuccess: (_data, vars) => {
      invalidate(vars.rid)
      toast.success('文件夹已创建')
    },
    onError: (e) => toast.error(errMsg(e, '创建文件夹失败')),
  })
}

export function useRenameFile() {
  const invalidate = useInvalidateTree()
  return useMutation({
    mutationFn: ({
      fileId,
      name,
    }: {
      fileId: string
      name: string
      rid: string
    }) => renameFile(fileId, name),
    onSuccess: (_data, vars) => {
      invalidate(vars.rid)
      toast.success('已重命名')
    },
    onError: (e) => toast.error(errMsg(e, '重命名失败')),
  })
}

/**
 * 拖拽 reorder —— **乐观更新**消除「拖完 ~1s 才更新」（旧实现无乐观态，靠
 * onSuccess invalidate 触发 network round-trip + 重拉才反映）。
 *
 * - onMutate：取消在途 files/resource 查询（避免重拉覆盖乐观态）；快照旧值；
 *   用 `applyReorder`（镜像后端 reorder_file 语义的纯函数）即时改写 files(rid)
 *   与 resource(rid).files 缓存；返回快照作 context。
 * - onError：回滚两份缓存 + toast.error。
 * - onSuccess：不再立即 invalidate（乐观态已就位）。
 * - onSettled：invalidate(rid) 与服务端对账兜底（应与乐观态一致，不产生闪烁）。
 */
export function useReorder() {
  const qc = useQueryClient()
  const invalidate = useInvalidateTree()
  return useMutation({
    mutationFn: ({ rid: _rid, ...body }: ReorderIn & { rid: string }) => reorder(body),
    onMutate: async (vars) => {
      const { rid, dragId, dropId, position } = vars
      // 取消在途查询，防止其 resolve 后覆盖我们的乐观写入。
      await qc.cancelQueries({ queryKey: keys.files(rid) })
      await qc.cancelQueries({ queryKey: keys.resource(rid) })

      const prevFiles = qc.getQueryData<MaterialFile[]>(keys.files(rid))
      const prevResource = qc.getQueryData<MaterialResource>(keys.resource(rid))

      if (prevFiles) {
        qc.setQueryData<MaterialFile[]>(
          keys.files(rid),
          applyReorder(prevFiles, { dragId, dropId, position }),
        )
      }
      if (prevResource) {
        qc.setQueryData<MaterialResource>(keys.resource(rid), {
          ...prevResource,
          files: applyReorder(prevResource.files, { dragId, dropId, position }),
        })
      }

      return { prevFiles, prevResource }
    },
    onError: (e, vars, context) => {
      // 回滚两份缓存到快照（仅当确有快照）。
      if (context?.prevFiles !== undefined) {
        qc.setQueryData(keys.files(vars.rid), context.prevFiles)
      }
      if (context?.prevResource !== undefined) {
        qc.setQueryData(keys.resource(vars.rid), context.prevResource)
      }
      toast.error(errMsg(e, '移动失败'))
    },
    onSettled: (_data, _err, vars) => {
      // 与服务端对账兜底（含列表的文件数 / 更新时间）。
      invalidate(vars.rid)
    },
  })
}

export function useDeleteFile() {
  const invalidate = useInvalidateTree()
  return useMutation({
    mutationFn: ({ fileId }: { fileId: string; rid: string }) => deleteFile(fileId),
    onSuccess: (_data, vars) => {
      invalidate(vars.rid)
      toast.success('文件已删除')
    },
    onError: (e) => toast.error(errMsg(e, '删除文件失败')),
  })
}

export function useDeleteFolder() {
  const invalidate = useInvalidateTree()
  return useMutation({
    mutationFn: ({ folderId }: { folderId: string; rid: string }) => deleteFolder(folderId),
    onSuccess: (_data, vars) => {
      invalidate(vars.rid)
      toast.success('文件夹已删除')
    },
    onError: (e) => toast.error(errMsg(e, '删除文件夹失败')),
  })
}

/**
 * 多文件上传 —— 走 `api/upload` 的 XHR，出**真实逐字节进度**（`onProgress`
 * 由调用方 UploadDialog 传入，把 ratio 灌进进度条）。多文件一次请求，进度是
 * 整体字节比。toast 仍在 hook 层（onSuccess/onError），不在 Dialog 渲染期调。
 */
export function useUploadFiles() {
  const invalidate = useInvalidateTree()
  return useMutation({
    mutationFn: ({
      rid,
      files,
      folderId,
      onProgress,
    }: {
      rid: string
      files: File[]
      folderId?: string | null
      onProgress?: (p: UploadProgress) => void
    }) => uploadFiles(rid, files, folderId, onProgress),
    onSuccess: (_data, vars) => {
      invalidate(vars.rid)
      toast.success(`已上传 ${vars.files.length} 个文件`)
    },
    onError: (e) => toast.error(errMsg(e, '上传失败')),
  })
}

export { keys as materialsKeys }
