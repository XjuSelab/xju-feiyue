import { z } from 'zod'

/**
 * Mirrors backend app/schemas/classes.py + group.py（camelCase wire）。
 * 班级空间（/classes/me/*）+ 小组（/groups/*）两个域共用本文件：
 * 前端 features/class 一个 feature 同时消费两者。
 *
 * 日期约定：点名时间戳是 ISO-8601 UTC（…Z）字符串；甘特任务的起止是
 * 纯日期 `YYYY-MM-DD`（含首尾，一天任务 start === end）。
 */

// ---------------------------------------------------------------------------
// 班级 + 成员
// ---------------------------------------------------------------------------

/** GET /classes/me —— 未分配班级时各字段为 null（200，不是 404）。 */
export const ClassMeSchema = z.object({
  classId: z.number().nullish(),
  classFullName: z.string().nullish(),
  classShortName: z.string().nullish(),
  isClassCommittee: z.boolean(),
  /** 自己的班委职务名称（班长 / 团支书 / …）；非班委为 null。 */
  committeeTitle: z.string().nullish(),
  memberCount: z.number(),
})
export type ClassMe = z.infer<typeof ClassMeSchema>

export const ClassMemberSchema = z.object({
  sid: z.string(),
  nickname: z.string(),
  name: z.string(),
  avatarThumb: z.string().url().nullish(),
  isClassCommittee: z.boolean(),
  /** 班委职务名称 —— 驱动着色徽标（班长/团支书红，其余橙）。 */
  committeeTitle: z.string().nullish(),
})
export type ClassMember = z.infer<typeof ClassMemberSchema>
export const ClassMemberListSchema = z.array(ClassMemberSchema)

// ---------------------------------------------------------------------------
// 点名（roll-call）
// ---------------------------------------------------------------------------

export const RollcallSummarySchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  createdBySid: z.string(),
  createdByNickname: z.string(),
  createdAt: z.string(),
  /** null = 点名中；非 null = 已完成（记录仍可改）。 */
  closedAt: z.string().nullish(),
  presentCount: z.number(),
  totalCount: z.number(),
})
export type RollcallSummary = z.infer<typeof RollcallSummarySchema>
export const RollcallListSchema = z.array(RollcallSummarySchema)

export const RollcallRecordSchema = z.object({
  sid: z.string(),
  nickname: z.string(),
  avatarThumb: z.string().url().nullish(),
  present: z.boolean(),
  checkedAt: z.string().nullish(),
})
export type RollcallRecord = z.infer<typeof RollcallRecordSchema>

export const RollcallDetailSchema = RollcallSummarySchema.extend({
  records: z.array(RollcallRecordSchema),
})
export type RollcallDetail = z.infer<typeof RollcallDetailSchema>

// ---------------------------------------------------------------------------
// 小组
// ---------------------------------------------------------------------------

export const GroupRoleSchema = z.enum(['leader', 'member'])
export type GroupRole = z.infer<typeof GroupRoleSchema>

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().url().nullish(),
  logoThumb: z.string().url().nullish(),
  intro: z.string(),
  leaderSid: z.string(),
  leaderNickname: z.string(),
  memberCount: z.number(),
  /** 观察者视角：null = 非成员。 */
  myRole: GroupRoleSchema.nullish(),
  /** 观察者自己的 pending 申请 id（用于「申请审核中」按钮态 + 撤回）。 */
  myPendingRequestId: z.string().nullish(),
  createdAt: z.string(),
})
export type Group = z.infer<typeof GroupSchema>
export const GroupListSchema = z.array(GroupSchema)

export const GroupMemberSchema = z.object({
  sid: z.string(),
  nickname: z.string(),
  avatarThumb: z.string().url().nullish(),
  role: GroupRoleSchema,
  joinedAt: z.string(),
})
export type GroupMember = z.infer<typeof GroupMemberSchema>

export const GroupDetailSchema = GroupSchema.extend({
  members: z.array(GroupMemberSchema),
  pendingCount: z.number(),
})
export type GroupDetail = z.infer<typeof GroupDetailSchema>

export const GroupCreateInSchema = z.object({
  name: z.string().trim().min(1, '小组名称不能为空').max(120, '小组名称最长 120 字'),
  intro: z.string().max(2000, '简介最长 2000 字').optional(),
})
export type GroupCreateIn = z.infer<typeof GroupCreateInSchema>

export const GroupUpdateInSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  intro: z.string().max(2000).optional(),
})
export type GroupUpdateIn = z.infer<typeof GroupUpdateInSchema>

export const JoinRequestSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  sid: z.string(),
  nickname: z.string(),
  avatarThumb: z.string().url().nullish(),
  message: z.string().nullish(),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string(),
  decidedBySid: z.string().nullish(),
  decidedAt: z.string().nullish(),
})
export type JoinRequest = z.infer<typeof JoinRequestSchema>
export const JoinRequestListSchema = z.array(JoinRequestSchema)

// ---------------------------------------------------------------------------
// 组内文件
// ---------------------------------------------------------------------------

export const GroupFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  ext: z.string().nullish(),
  mime: z.string().nullish(),
  /** 人类可读大小（"1.2 MB"）。 */
  size: z.string().nullish(),
  sizeBytes: z.number().nullish(),
  url: z.string().url().nullish(),
  uploadedBySid: z.string(),
  uploadedByNickname: z.string(),
  createdAt: z.string(),
})
export type GroupFile = z.infer<typeof GroupFileSchema>
export const GroupFileListSchema = z.array(GroupFileSchema)

// ---------------------------------------------------------------------------
// 甘特任务
// ---------------------------------------------------------------------------

export const TaskStatusSchema = z.enum(['todo', 'doing', 'done'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD')

export const TaskAssigneeSchema = z.object({
  sid: z.string(),
  nickname: z.string(),
  avatarThumb: z.string().url().nullish(),
})

export const GroupTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  assigneeSids: z.array(z.string()),
  assignees: z.array(TaskAssigneeSchema),
  startDate: dateStr,
  endDate: dateStr,
  status: TaskStatusSchema,
  progress: z.number().int().min(0).max(100),
  createdBySid: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type GroupTask = z.infer<typeof GroupTaskSchema>
export const GroupTaskListSchema = z.array(GroupTaskSchema)

export const TaskCreateInSchema = z
  .object({
    title: z.string().trim().min(1, '任务标题不能为空').max(255),
    description: z.string().max(4000).optional(),
    assigneeSids: z.array(z.string()).default([]),
    startDate: dateStr,
    endDate: dateStr,
    status: TaskStatusSchema.default('todo'),
    progress: z.number().int().min(0).max(100).default(0),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: '结束日期不能早于开始日期',
    path: ['endDate'],
  })
export type TaskCreateIn = z.infer<typeof TaskCreateInSchema>

/** PATCH 体（部分更新）；跨字段日期校验由后端对合并值兜底。 */
export const TaskUpdateInSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(4000).optional(),
  assigneeSids: z.array(z.string()).optional(),
  startDate: dateStr.optional(),
  endDate: dateStr.optional(),
  status: TaskStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
})
export type TaskUpdateIn = z.infer<typeof TaskUpdateInSchema>
