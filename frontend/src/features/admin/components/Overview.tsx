import { FileText, FolderOpen, HardDrive, Layers, LogIn, ShieldCheck, Users } from 'lucide-react'

import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { formatBytes } from '@/lib/fileTypes'

import { useAdminStats } from '../hooks/useAdmin'
import { ROLE_LABEL, formatRelative } from '../lib/format'
import type { Role } from '@/api/schemas/admin'
import { BarChart, Donut, HBars, type Slice } from './charts'
import { RoleBadge } from './RoleBadge'
import { RecentLogins } from './RecentLogins'
import { StatCard } from './StatCard'

// Chart accents — system-derived tokens (see tokens.css): link 蓝 for logins,
// 提亮的 cat-tools 青绿 for uploads. A coordinated cool pair that stays on the
// Notion palette.
const LOGIN_BLUE = 'var(--chart-blue)'
const UPLOAD_TEAL = 'var(--chart-teal)'

const ROLE_COLOR: Record<string, string> = {
  superadmin: 'var(--cat-research)',
  admin: 'var(--cat-kaggle)',
  user: 'var(--color-text-faint)',
}
const ROLE_ORDER = ['superadmin', 'admin', 'user']

export function Overview() {
  const { data, isPending, isError, error, refetch } = useAdminStats()

  if (isPending) return <LoadingSkeleton preset="card" count={4} />
  if (isError) {
    return <ErrorState title="加载统计失败" message={error?.message ?? ''} onRetry={() => void refetch()} />
  }

  const roleMap = new Map(data.roleBreakdown.map((r) => [r.role, r.count]))
  const slices: Slice[] = ROLE_ORDER.filter((r) => (roleMap.get(r) ?? 0) > 0).map((r) => ({
    label: ROLE_LABEL[r as Role] ?? r,
    value: roleMap.get(r) ?? 0,
    color: ROLE_COLOR[r] ?? 'var(--color-text-faint)',
  }))

  const bars = data.loginActivity.map((d) => ({
    label: d.date.slice(5), // MM-DD
    value: d.count,
    title: `${d.date}：${d.count} 次登录`,
  }))

  const topRows = data.topUploaders.map((u) => ({
    label: u.nickname,
    value: u.fileCount,
    hint: `${u.fileCount} 个 · ${formatBytes(u.sizeBytes)}`,
  }))

  return (
    <div className="space-y-5">
      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="总用户" value={data.totalUsers} Icon={Users} accent="text-cat-kaggle" />
        <StatCard
          label="管理员"
          value={data.totalAdmins}
          sub="管理 + 超管"
          Icon={ShieldCheck}
          accent="text-cat-research"
        />
        <StatCard label="资料" value={data.totalResources} Icon={FolderOpen} accent="text-cat-tools" />
        <StatCard
          label="文件"
          value={data.totalFiles}
          sub={formatBytes(data.totalStorageBytes)}
          Icon={Layers}
          accent="text-cat-recommend"
        />
        <StatCard label="笔记" value={data.totalNotes} Icon={FileText} accent="text-cat-course" />
        <StatCard label="今日登录" value={data.loginsToday} Icon={LogIn} accent="text-cat-kaggle" />
        <StatCard
          label="存储占用"
          value={formatBytes(data.totalStorageBytes)}
          Icon={HardDrive}
          accent="text-text-muted"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Role distribution */}
        <Panel title="角色分布">
          <Donut slices={slices} total={data.totalUsers} centerLabel="用户" />
        </Panel>

        {/* Login activity */}
        <Panel title="近 14 天登录活跃">
          <BarChart bars={bars} color={LOGIN_BLUE} />
        </Panel>

        {/* Top uploaders */}
        <Panel title="资料上传 Top 5">
          <HBars rows={topRows} color={UPLOAD_TEAL} />
        </Panel>

        {/* Recent signups */}
        <Panel title="最近注册">
          {data.recentSignups.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-faint">暂无数据</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentSignups.map((u) => (
                <li key={u.sid} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-text">{u.nickname}</span>
                  <RoleBadge role={u.role as Role} />
                  <span className="shrink-0 text-xs text-text-faint">{formatRelative(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* 最近登录：具体登录的人 + 设备 / IP / 时间（比登录活跃柱状信息更全）。 */}
      <RecentLogins />
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-bg p-4">
      <h3 className="mb-3 text-sm font-semibold text-text">{title}</h3>
      {children}
    </section>
  )
}
