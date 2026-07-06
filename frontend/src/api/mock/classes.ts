/**
 * /classes/me/* + /groups/* 的 mock dispatch（dev 默认 mock 模式必备 ——
 * 漏注册任何一条路径 client.ts 会直接 501）。内存态：刷新即重置。
 *
 * Mock 世界观：当前登录用户 = 20211010001（计算机24-3 的班委），班里另有
 * 5 名同学；预置 2 个小组（当前用户是「飞跃小队」组长）、1 条点名历史、
 * 若干甘特任务与文件元数据。
 */
import { ApiError, registerMock, type MockReq } from '../client'

const ME = '20211010001'

type MockMember = {
  sid: string
  nickname: string
  name: string
  avatarThumb: string | null
  isClassCommittee: boolean
  committeeTitle: string | null
}

const MEMBERS: MockMember[] = [
  { sid: '20211010001', nickname: '测试同学', name: '测试同学', avatarThumb: null, isClassCommittee: true, committeeTitle: '班长' },
  { sid: '20211010002', nickname: '张三', name: '张三', avatarThumb: null, isClassCommittee: false, committeeTitle: null },
  { sid: '20211010003', nickname: '李四', name: '李四', avatarThumb: null, isClassCommittee: false, committeeTitle: null },
  { sid: '20211010004', nickname: '王五', name: '王五', avatarThumb: null, isClassCommittee: false, committeeTitle: null },
  { sid: '20211010005', nickname: '赵六', name: '赵六', avatarThumb: null, isClassCommittee: false, committeeTitle: null },
  { sid: '20211010006', nickname: '孙七', name: '孙七', avatarThumb: null, isClassCommittee: false, committeeTitle: null },
]

const memberOf = (sid: string): MockMember =>
  MEMBERS.find((m) => m.sid === sid) ?? {
    sid,
    nickname: sid,
    name: sid,
    avatarThumb: null,
    isClassCommittee: false,
    committeeTitle: null,
  }

let seq = 1
const nextId = (prefix: string) => `${prefix}_${String(seq++).padStart(4, '0')}`
const nowIso = () => new Date().toISOString()
const todayStr = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const shiftDay = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d! + n))
  const p = (x: number) => String(x).padStart(2, '0')
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`
}

// ---------------------------------------------------------------------------
// 内存态
// ---------------------------------------------------------------------------

type MockRollcall = {
  id: string
  title: string | null
  createdBySid: string
  createdAt: string
  closedAt: string | null
  records: Map<string, { present: boolean; checkedAt: string | null }>
}

const rollcalls: MockRollcall[] = []

type MockGroup = {
  id: string
  name: string
  logo: string | null
  logoThumb: string | null
  intro: string
  leaderSid: string
  createdAt: string
  members: Map<string, { role: 'leader' | 'member'; joinedAt: string }>
}

type MockJoinRequest = {
  id: string
  groupId: string
  sid: string
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  decidedBySid: string | null
  decidedAt: string | null
}

type MockFile = {
  id: string
  groupId: string
  name: string
  ext: string | null
  mime: string | null
  size: string | null
  sizeBytes: number | null
  url: string | null
  uploadedBySid: string
  createdAt: string
}

type MockTask = {
  id: string
  groupId: string
  title: string
  description: string
  assigneeSids: string[]
  startDate: string
  endDate: string
  status: 'todo' | 'doing' | 'done'
  progress: number
  createdBySid: string
  createdAt: string
  updatedAt: string
}

type MockMission = {
  id: string
  title: string
  description: string
  isActive: boolean
  createdBySid: string
  createdAt: string
  updatedAt: string
}

const groups: MockGroup[] = []
const joinRequests: MockJoinRequest[] = []
const files: MockFile[] = []
const tasks: MockTask[] = []
const missions: MockMission[] = []

// --- 预置数据 ---------------------------------------------------------------

function seed() {
  const g1: MockGroup = {
    id: nextId('grp'),
    name: '飞跃小队',
    logo: null,
    logoThumb: null,
    intro: '软件工程课设小组 —— 做一个班级管理系统。',
    leaderSid: ME,
    createdAt: nowIso(),
    members: new Map([
      [ME, { role: 'leader', joinedAt: nowIso() }],
      ['20211010002', { role: 'member', joinedAt: nowIso() }],
      ['20211010003', { role: 'member', joinedAt: nowIso() }],
    ]),
  }
  const g2: MockGroup = {
    id: nextId('grp'),
    name: '摸鱼特攻队',
    logo: null,
    logoThumb: null,
    intro: '',
    leaderSid: '20211010004',
    createdAt: nowIso(),
    members: new Map([['20211010004', { role: 'leader', joinedAt: nowIso() }]]),
  }
  groups.push(g1, g2)

  joinRequests.push({
    id: nextId('req'),
    groupId: g1.id,
    sid: '20211010005',
    message: '带我一个，会写前端',
    status: 'pending',
    createdAt: nowIso(),
    decidedBySid: null,
    decidedAt: null,
  })

  const today = todayStr()
  tasks.push(
    {
      id: nextId('task'),
      groupId: g1.id,
      title: '需求分析与原型',
      description: '',
      assigneeSids: [ME, '20211010002'],
      startDate: shiftDay(today, -6),
      endDate: shiftDay(today, -2),
      status: 'done',
      progress: 100,
      createdBySid: ME,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: nextId('task'),
      groupId: g1.id,
      title: '后端 API 开发',
      description: '班级/小组/点名三个模块',
      assigneeSids: ['20211010002'],
      startDate: shiftDay(today, -3),
      endDate: shiftDay(today, 4),
      status: 'doing',
      progress: 40,
      createdBySid: ME,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: nextId('task'),
      groupId: g1.id,
      title: '前端页面与联调',
      description: '',
      assigneeSids: ['20211010003'],
      startDate: shiftDay(today, 2),
      endDate: shiftDay(today, 9),
      status: 'todo',
      progress: 0,
      createdBySid: ME,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  )

  files.push({
    id: nextId('file'),
    groupId: g1.id,
    name: '需求文档v1.pdf',
    ext: 'pdf',
    mime: 'application/pdf',
    size: '1.2 MB',
    sizeBytes: 1_258_291,
    url: null,
    uploadedBySid: ME,
    createdAt: nowIso(),
  })

  missions.push({
    id: nextId('mission'),
    title: '软件工程课程设计 · 第一次分组',
    description: '按兴趣自由组队（3–5 人），选定课设选题并推选组长。',
    isActive: true,
    createdBySid: ME,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })

  const rc: MockRollcall = {
    id: nextId('rc'),
    title: '软件工程第 1 周',
    createdBySid: ME,
    createdAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    closedAt: new Date(Date.now() - 86_400_000 * 3 + 600_000).toISOString(),
    records: new Map(
      MEMBERS.map((m) => [m.sid, { present: m.sid !== '20211010006', checkedAt: nowIso() }]),
    ),
  }
  rollcalls.push(rc)
}
seed()

// ---------------------------------------------------------------------------
// 序列化
// ---------------------------------------------------------------------------

function rollcallSummary(rc: MockRollcall) {
  const records = [...rc.records.values()]
  return {
    id: rc.id,
    title: rc.title,
    createdBySid: rc.createdBySid,
    createdByNickname: memberOf(rc.createdBySid).nickname,
    createdAt: rc.createdAt,
    closedAt: rc.closedAt,
    presentCount: records.filter((r) => r.present).length,
    totalCount: records.length,
  }
}

function rollcallDetail(rc: MockRollcall) {
  return {
    ...rollcallSummary(rc),
    records: [...rc.records.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sid, r]) => {
        const m = memberOf(sid)
        return {
          sid,
          nickname: m.nickname,
          avatarThumb: m.avatarThumb,
          present: r.present,
          checkedAt: r.checkedAt,
        }
      }),
  }
}

function groupOut(g: MockGroup) {
  const mine = g.members.get(ME)
  const pending = joinRequests.find(
    (r) => r.groupId === g.id && r.sid === ME && r.status === 'pending',
  )
  return {
    id: g.id,
    name: g.name,
    logo: g.logo,
    logoThumb: g.logoThumb,
    intro: g.intro,
    leaderSid: g.leaderSid,
    leaderNickname: memberOf(g.leaderSid).nickname,
    memberCount: g.members.size,
    myRole: mine?.role ?? null,
    myPendingRequestId: pending?.id ?? null,
    createdAt: g.createdAt,
  }
}

function groupDetail(g: MockGroup) {
  return {
    ...groupOut(g),
    members: [...g.members.entries()].map(([sid, m]) => {
      const p = memberOf(sid)
      return {
        sid,
        nickname: p.nickname,
        avatarThumb: p.avatarThumb,
        role: m.role,
        joinedAt: m.joinedAt,
      }
    }),
    pendingCount: joinRequests.filter((r) => r.groupId === g.id && r.status === 'pending')
      .length,
  }
}

function requestOut(r: MockJoinRequest) {
  const m = memberOf(r.sid)
  return { ...r, nickname: m.nickname, avatarThumb: m.avatarThumb }
}

function fileOut(f: MockFile) {
  const m = memberOf(f.uploadedBySid)
  return { ...f, uploadedByNickname: m.nickname, groupId: undefined }
}

function taskOut(t: MockTask) {
  return {
    ...t,
    groupId: undefined,
    assignees: t.assigneeSids.map((sid) => {
      const m = memberOf(sid)
      return { sid, nickname: m.nickname, avatarThumb: m.avatarThumb }
    }),
  }
}

// ---------------------------------------------------------------------------
// 查找辅助
// ---------------------------------------------------------------------------

const seg = (req: MockReq, i: number): string => req.path.split('/')[i] ?? ''

function findGroup(gid: string): MockGroup {
  const g = groups.find((x) => x.id === gid)
  if (!g) throw new ApiError('小组不存在', 404, gid)
  return g
}

function myGroup(): MockGroup | undefined {
  return groups.find((g) => g.members.has(ME))
}

// ---------------------------------------------------------------------------
// /classes/me — 班级 + 成员 + 点名
// ---------------------------------------------------------------------------

registerMock('GET', '/classes/me', async () => ({
  classId: 1,
  classFullName: '计算机科学与技术24-3',
  classShortName: '计算机24-3',
  isClassCommittee: true,
  committeeTitle: '班长',
  memberCount: MEMBERS.length,
}))

registerMock('GET', '/classes/me/members', async () => MEMBERS)

registerMock('POST', '/classes/me/members/:sid/committee', async (req) => {
  const sid = seg(req, 3)
  const body = req.body as { isClassCommittee: boolean; committeeTitle?: string }
  const m = MEMBERS.find((x) => x.sid === sid)
  if (!m) throw new ApiError('该同学不在本班级', 404, req.path)
  m.isClassCommittee = body.isClassCommittee
  m.committeeTitle = body.isClassCommittee ? (body.committeeTitle?.trim() || null) : null
  return m
})

registerMock('DELETE', '/admin/users/:sid', async (req) => {
  const sid = req.path.split('/')[3] ?? ''
  const i = MEMBERS.findIndex((m) => m.sid === sid)
  if (i >= 0) MEMBERS.splice(i, 1)
  for (const g of groups) g.members.delete(sid)
  return null
})

registerMock('GET', '/classes/me/groups/unassigned', async () => {
  const inGroup = new Set(groups.flatMap((g) => [...g.members.keys()]))
  return MEMBERS.filter((m) => !inGroup.has(m.sid))
})

registerMock('POST', '/classes/me/rollcalls', async (req) => {
  const body = req.body as { title?: string } | undefined
  const rc: MockRollcall = {
    id: nextId('rc'),
    title: body?.title?.trim() || null,
    createdBySid: ME,
    createdAt: nowIso(),
    closedAt: null,
    records: new Map(MEMBERS.map((m) => [m.sid, { present: false, checkedAt: null }])),
  }
  rollcalls.unshift(rc)
  return rollcallDetail(rc)
})

registerMock('GET', '/classes/me/rollcalls', async () => rollcalls.map(rollcallSummary))

registerMock('GET', '/classes/me/rollcalls/:id', async (req) => {
  const rc = rollcalls.find((x) => x.id === seg(req, 3))
  if (!rc) throw new ApiError('点名记录不存在', 404, req.path)
  return rollcallDetail(rc)
})

registerMock('PUT', '/classes/me/rollcalls/:id/records/:sid', async (req) => {
  const rc = rollcalls.find((x) => x.id === seg(req, 3))
  if (!rc) throw new ApiError('点名记录不存在', 404, req.path)
  const sid = seg(req, 5)
  const body = req.body as { present: boolean }
  rc.records.set(sid, { present: body.present, checkedAt: nowIso() })
  const m = memberOf(sid)
  return {
    sid,
    nickname: m.nickname,
    avatarThumb: m.avatarThumb,
    present: body.present,
    checkedAt: nowIso(),
  }
})

registerMock('PATCH', '/classes/me/rollcalls/:id', async (req) => {
  const rc = rollcalls.find((x) => x.id === seg(req, 3))
  if (!rc) throw new ApiError('点名记录不存在', 404, req.path)
  const body = req.body as { title?: string; closed?: boolean }
  if (body.title !== undefined) rc.title = body.title.trim() || null
  if (body.closed === true) rc.closedAt = nowIso()
  if (body.closed === false) rc.closedAt = null
  return rollcallSummary(rc)
})

registerMock('DELETE', '/classes/me/rollcalls/:id', async (req) => {
  const i = rollcalls.findIndex((x) => x.id === seg(req, 3))
  if (i >= 0) rollcalls.splice(i, 1)
  return null
})

// ---------------------------------------------------------------------------
// 分组任务（mission）
// ---------------------------------------------------------------------------

const missionSorted = () =>
  [...missions].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return b.createdAt.localeCompare(a.createdAt)
  })

registerMock('GET', '/classes/me/missions', async () => missionSorted())

registerMock('POST', '/classes/me/missions', async (req) => {
  const body = req.body as { title: string; description?: string; active?: boolean }
  const active = body.active ?? true
  if (active) missions.forEach((m) => (m.isActive = false))
  const m: MockMission = {
    id: nextId('mission'),
    title: body.title.trim(),
    description: body.description?.trim() ?? '',
    isActive: active,
    createdBySid: ME,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  missions.push(m)
  return m
})

registerMock('PATCH', '/classes/me/missions/:id', async (req) => {
  const m = missions.find((x) => x.id === seg(req, 4))
  if (!m) throw new ApiError('分组任务不存在', 404, req.path)
  const body = req.body as { title?: string; description?: string; active?: true }
  if (body.title !== undefined) m.title = body.title.trim()
  if (body.description !== undefined) m.description = body.description.trim()
  if (body.active === true) {
    missions.forEach((x) => (x.isActive = false))
    m.isActive = true
  }
  m.updatedAt = nowIso()
  return m
})

registerMock('DELETE', '/classes/me/missions/:id', async (req) => {
  const i = missions.findIndex((x) => x.id === seg(req, 4))
  if (i >= 0) missions.splice(i, 1)
  return null
})

// ---------------------------------------------------------------------------
// 小组
// ---------------------------------------------------------------------------

registerMock('GET', '/classes/me/groups', async () => groups.map(groupOut))

registerMock('POST', '/classes/me/groups', async (req) => {
  const body = req.body as { name: string; intro?: string }
  if (myGroup()) throw new ApiError('你已加入其他小组', 409, req.path)
  if (groups.some((g) => g.name === body.name.trim())) {
    throw new ApiError('本班已存在同名小组', 409, req.path)
  }
  const g: MockGroup = {
    id: nextId('grp'),
    name: body.name.trim(),
    logo: null,
    logoThumb: null,
    intro: body.intro?.trim() ?? '',
    leaderSid: ME,
    createdAt: nowIso(),
    members: new Map([[ME, { role: 'leader', joinedAt: nowIso() }]]),
  }
  groups.push(g)
  return groupOut(g)
})

registerMock('GET', '/groups/:gid', async (req) => groupDetail(findGroup(seg(req, 2))))

registerMock('PATCH', '/groups/:gid', async (req) => {
  const g = findGroup(seg(req, 2))
  const body = req.body as { name?: string; intro?: string }
  if (body.name !== undefined) g.name = body.name.trim()
  if (body.intro !== undefined) g.intro = body.intro.trim()
  return groupDetail(g)
})

registerMock('POST', '/groups/:gid/logo', async (req) => {
  // FormData 里的图片在 mock 里无处可存 —— 用 data URL 占位即可预览。
  const g = findGroup(seg(req, 2))
  const form = req.body as FormData
  const file = form.get('file')
  if (file instanceof File) {
    const url = URL.createObjectURL(file)
    g.logo = url
    g.logoThumb = url
  }
  return groupDetail(g)
})

registerMock('DELETE', '/groups/:gid', async (req) => {
  const i = groups.findIndex((x) => x.id === seg(req, 2))
  if (i >= 0) groups.splice(i, 1)
  return null
})

registerMock('POST', '/groups/:gid/join-requests', async (req) => {
  const g = findGroup(seg(req, 2))
  if (myGroup()) throw new ApiError('你已加入其他小组', 409, req.path)
  const body = req.body as { message?: string } | undefined
  const r: MockJoinRequest = {
    id: nextId('req'),
    groupId: g.id,
    sid: ME,
    message: body?.message?.trim() || null,
    status: 'pending',
    createdAt: nowIso(),
    decidedBySid: null,
    decidedAt: null,
  }
  joinRequests.push(r)
  return requestOut(r)
})

registerMock('GET', '/groups/:gid/join-requests', async (req) => {
  const gid = seg(req, 2)
  const status = req.query.get('status')
  return joinRequests
    .filter((r) => r.groupId === gid && (!status || r.status === status))
    .map(requestOut)
})

registerMock('POST', '/groups/:gid/join-requests/:rid/approve', async (req) => {
  const g = findGroup(seg(req, 2))
  const r = joinRequests.find((x) => x.id === seg(req, 4))
  if (!r || r.status !== 'pending') throw new ApiError('该申请已被处理', 409, req.path)
  g.members.set(r.sid, { role: 'member', joinedAt: nowIso() })
  r.status = 'approved'
  r.decidedBySid = ME
  r.decidedAt = nowIso()
  return requestOut(r)
})

registerMock('POST', '/groups/:gid/join-requests/:rid/reject', async (req) => {
  const r = joinRequests.find((x) => x.id === seg(req, 4))
  if (!r || r.status !== 'pending') throw new ApiError('该申请已被处理', 409, req.path)
  r.status = 'rejected'
  r.decidedBySid = ME
  r.decidedAt = nowIso()
  return requestOut(r)
})

registerMock('DELETE', '/groups/:gid/join-requests/:rid', async (req) => {
  const i = joinRequests.findIndex((x) => x.id === seg(req, 4))
  if (i >= 0) joinRequests.splice(i, 1)
  return null
})

registerMock('DELETE', '/groups/:gid/members/:sid', async (req) => {
  const g = findGroup(seg(req, 2))
  const sid = seg(req, 4)
  if (sid === g.leaderSid) throw new ApiError('组长请先转让组长或解散小组', 400, req.path)
  g.members.delete(sid)
  return null
})

registerMock('POST', '/groups/:gid/transfer-leader', async (req) => {
  const g = findGroup(seg(req, 2))
  const body = req.body as { sid: string }
  const target = g.members.get(body.sid)
  if (!target) throw new ApiError('该同学不在小组中', 404, req.path)
  const old = g.members.get(g.leaderSid)
  if (old) old.role = 'member'
  target.role = 'leader'
  g.leaderSid = body.sid
  return groupDetail(g)
})

// ---------------------------------------------------------------------------
// 组内文件
// ---------------------------------------------------------------------------

registerMock('GET', '/groups/:gid/files', async (req) => {
  const gid = seg(req, 2)
  return files.filter((f) => f.groupId === gid).map(fileOut)
})

registerMock('POST', '/groups/:gid/files', async (req) => {
  const gid = seg(req, 2)
  findGroup(gid)
  const form = req.body as FormData
  for (const entry of form.getAll('files')) {
    if (!(entry instanceof File)) continue
    const ext = entry.name.includes('.') ? entry.name.split('.').pop()!.toLowerCase() : null
    files.unshift({
      id: nextId('file'),
      groupId: gid,
      name: entry.name,
      ext,
      mime: entry.type || null,
      size: `${Math.max(1, Math.round(entry.size / 1024))} KB`,
      sizeBytes: entry.size,
      url: null,
      uploadedBySid: ME,
      createdAt: nowIso(),
    })
  }
  return files.filter((f) => f.groupId === gid).map(fileOut)
})

registerMock('DELETE', '/groups/:gid/files/:fid', async (req) => {
  const i = files.findIndex((x) => x.id === seg(req, 4))
  if (i >= 0) files.splice(i, 1)
  return null
})

// ---------------------------------------------------------------------------
// 甘特任务
// ---------------------------------------------------------------------------

registerMock('GET', '/groups/:gid/tasks', async (req) => {
  const gid = seg(req, 2)
  return tasks
    .filter((t) => t.groupId === gid)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(taskOut)
})

registerMock('POST', '/groups/:gid/tasks', async (req) => {
  const gid = seg(req, 2)
  findGroup(gid)
  const body = req.body as {
    title: string
    description?: string
    assigneeSids?: string[]
    startDate: string
    endDate: string
    status?: 'todo' | 'doing' | 'done'
    progress?: number
  }
  const t: MockTask = {
    id: nextId('task'),
    groupId: gid,
    title: body.title.trim(),
    description: body.description?.trim() ?? '',
    assigneeSids: body.assigneeSids ?? [],
    startDate: body.startDate,
    endDate: body.endDate,
    status: body.status ?? 'todo',
    progress: body.progress ?? 0,
    createdBySid: ME,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  tasks.push(t)
  return taskOut(t)
})

registerMock('PATCH', '/groups/:gid/tasks/:tid', async (req) => {
  const t = tasks.find((x) => x.id === seg(req, 4))
  if (!t) throw new ApiError('任务不存在', 404, req.path)
  const body = req.body as Partial<MockTask>
  if (body.title !== undefined) t.title = body.title
  if (body.description !== undefined) t.description = body.description
  if (body.assigneeSids !== undefined) t.assigneeSids = body.assigneeSids
  if (body.startDate !== undefined) t.startDate = body.startDate
  if (body.endDate !== undefined) t.endDate = body.endDate
  if (t.endDate < t.startDate) throw new ApiError('结束日期不能早于开始日期', 400, req.path)
  if (body.status !== undefined) t.status = body.status
  if (body.progress !== undefined) t.progress = body.progress
  t.updatedAt = nowIso()
  return taskOut(t)
})

registerMock('DELETE', '/groups/:gid/tasks/:tid', async (req) => {
  const i = tasks.findIndex((x) => x.id === seg(req, 4))
  if (i >= 0) tasks.splice(i, 1)
  return null
})
