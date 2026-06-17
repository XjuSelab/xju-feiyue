import { z } from 'zod'

/**
 * /materials/* 域的 runtime 校验层 —— wire 为 camelCase（后端 CamelModel，
 * app/schemas/material.py），与 /schools 的 snake_case 不同。
 *
 * 设计要点：
 * - 文件树递归：`MaterialFileSchema.children` 是 `MaterialFile[]`，用 `z.lazy`
 *   打破前向引用环（仿 zod 官方递归 schema 范式）。先声明 `MaterialFile` 类型，
 *   再用 `z.ZodType<MaterialFile>` 标注 lazy schema。
 * - 204 端点（reorder/delete*）在 endpoints 层用 `z.null()` 校验空体（client.ts
 *   把 204 归一成 `null`）。
 * - 字段顺序与 features/materials/types.ts 对齐；types.ts 从这里 `z.infer`。
 *
 * 「资料」= 共享知识库：所有登录用户可浏览全部未删资源；写/删某资源仅 owner 可。
 */

/** 课程类型 —— 资源卡角标 + 列表筛选选项卡。null = 未分类（无徽章）。 */
export const ResourceTagSchema = z.enum(['专业课', '通识课', '实验课'])
export type ResourceTag = z.infer<typeof ResourceTagSchema>

/** 拖拽落点语义（reorder API body 的 position 字段）。 */
export const ReorderPositionSchema = z.enum(['before', 'after', 'inside'])
export type ReorderPosition = z.infer<typeof ReorderPositionSchema>

/**
 * 递归文件树节点。先声明 TS 类型，再用 `z.lazy` 自引用 `children`。
 * - 文件夹：isFolder=true，children 非空可有；ext/mime/size/url 为 null。
 * - 文件：isFolder=false，children=[]，ext/mime/size/sizeBytes/url 多为非 null。
 */
export type MaterialFile = {
  id: string
  name: string
  isFolder: boolean
  ext: string | null
  mime: string | null
  /** 人类可读体积（"1.2 MB"）；文件夹为 null。 */
  size: string | null
  /** 原始字节数；文件夹为 null。 */
  sizeBytes: number | null
  url: string | null
  children: MaterialFile[]
}

/**
 * 后端 CamelModel 序列化时**每个字段都会出现**（含 ext=null / children=[]），
 * 故这里不用 `.default(...)`：用 `.nullable()` / 必填数组即可，让 schema 的
 * input 与 output 类型一致，避免 `request<T>` 把可缺省 input 推成返回类型。
 */
export const MaterialFileSchema: z.ZodType<MaterialFile> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    isFolder: z.boolean(),
    ext: z.string().nullable(),
    mime: z.string().nullable(),
    size: z.string().nullable(),
    sizeBytes: z.number().int().nullable(),
    url: z.string().nullable(),
    children: z.array(MaterialFileSchema),
  }),
)

export const MaterialResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  tag: ResourceTagSchema.nullable(),
  ownerSid: z.string(),
  /** `onupdate=now` 镜像 —— 卡片「更新于」时间戳（ISO 8601）。 */
  updateDate: z.string(),
  createdAt: z.string(),
  /** 列表场景为空数组（后端省略树）；详情场景为组好的文件树。 */
  files: z.array(MaterialFileSchema),
})
export type MaterialResource = z.infer<typeof MaterialResourceSchema>

export const MaterialResourceListSchema = z.array(MaterialResourceSchema)

export const MaterialFileTreeSchema = z.array(MaterialFileSchema)

/** POST /materials/resources body。 */
export const ResourceCreateInSchema = z.object({
  title: z.string(),
  description: z.string().nullish(),
  tag: ResourceTagSchema.nullish(),
})
export type ResourceCreateIn = z.infer<typeof ResourceCreateInSchema>

/** PATCH /materials/resources/{rid} body —— 全可选；`tag:null` 显式清除。 */
export const ResourceUpdateInSchema = z.object({
  title: z.string().nullish(),
  description: z.string().nullish(),
  tag: ResourceTagSchema.nullish(),
})
export type ResourceUpdateIn = z.infer<typeof ResourceUpdateInSchema>

/** POST /materials/resources/{rid}/folders body。 */
export const FolderCreateInSchema = z.object({
  name: z.string(),
  parentId: z.string().nullish(),
})
export type FolderCreateIn = z.infer<typeof FolderCreateInSchema>

/** PATCH /materials/files/{fileId}/rename body。 */
export const RenameInSchema = z.object({
  name: z.string(),
})
export type RenameIn = z.infer<typeof RenameInSchema>

/** POST /materials/files/reorder body。 */
export const ReorderInSchema = z.object({
  dragId: z.string(),
  dropId: z.string(),
  position: ReorderPositionSchema,
})
export type ReorderIn = z.infer<typeof ReorderInSchema>

/** 204 空体端点（reorder / deleteFile / deleteFolder / deleteResource）。 */
export const NoContentSchema = z.null()

// ---------------------------------------------------------------------------
// 致谢信息条（资料列表页顶部的 credits bar）
// ---------------------------------------------------------------------------

/**
 * GET /materials/notice —— 单例致谢条。`content` 为纯文本（前端把裸 http(s)
 * 链接渲染成可点击）；`visible=false` = 管理员已隐藏（普通用户不渲染）。
 */
export const MaterialNoticeSchema = z.object({
  content: z.string(),
  visible: z.boolean(),
  updateDate: z.string(),
})
export type MaterialNotice = z.infer<typeof MaterialNoticeSchema>

/** PUT /materials/notice body（管理员）。 */
export const NoticeUpdateInSchema = z.object({
  content: z.string(),
})
export type NoticeUpdateIn = z.infer<typeof NoticeUpdateInSchema>
