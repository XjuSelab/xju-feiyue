/** 班级域 query key 工厂 —— 全 feature 共用，invalidate 时对齐。 */
export const classKeys = {
  all: ['class'] as const,
  me: ['class', 'me'] as const,
  members: ['class', 'members'] as const,
  missions: ['class', 'missions'] as const,
  rollcalls: ['class', 'rollcalls'] as const,
  rollcall: (id: string) => ['class', 'rollcall', id] as const,
  groups: ['class', 'groups'] as const,
  group: (gid: string) => ['class', 'group', gid] as const,
  joinRequests: (gid: string) => ['class', 'group', gid, 'join-requests'] as const,
  files: (gid: string) => ['class', 'group', gid, 'files'] as const,
  tasks: (gid: string) => ['class', 'group', gid, 'tasks'] as const,
}

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}
