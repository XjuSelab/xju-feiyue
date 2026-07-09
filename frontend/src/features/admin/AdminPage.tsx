import { ShieldAlert } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/stores/authStore'
import type { Role } from '@/api/schemas/admin'

import { Overview } from './components/Overview'
import { UsersTab } from './components/UsersTab'
import { MaterialsTab } from './components/MaterialsTab'
import { ReportsTab } from './components/ReportsTab'
import { RoleBadge } from './components/RoleBadge'

/**
 * 隐藏的管理后台 —— 仅 URL 进入（无导航按钮，呼应后端 /admin/* 对非管理员返回 404）。
 *
 * - 角色守卫：非 admin/superadmin 渲染「页面不存在」NotFound 视图，不泄露后台存在。
 * - 四 Tab：概览（统计 + 内置 SVG 可视化）/ 用户（表 + 重置密码 + 导入 + 升降级）/
 *   资料（全量资料 + 删除）/ 工单（举报处理 + AI 预审）。
 * - 后端对每个写操作再次鉴权（层级守卫），前端按权限隐藏按钮只是 UX。
 */
export function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const role: Role = (user?.role as Role) ?? 'user'
  const isAdmin = !!user && (user.isAdmin === true || role === 'admin' || role === 'superadmin')
  const isSuperAdmin =
    !!user && (user.isSuperAdmin === true || role === 'superadmin')

  if (!isAdmin) return <NotFound />

  return (
    <main className="w-full px-7 pb-24 pt-7 xl:px-10">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.01em] text-text">
          管理后台
        </h1>
        {user ? <RoleBadge role={role} /> : null}
        <span className="ml-auto text-sm text-text-muted">{user?.nickname}</span>
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-5">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="users">用户</TabsTrigger>
          <TabsTrigger value="materials">资料</TabsTrigger>
          <TabsTrigger value="reports">工单</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Overview />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab currentSid={user?.sid ?? ''} isSuperAdmin={isSuperAdmin} />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialsTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </main>
  )
}

/** Mirrors the backend's 404-for-non-admins: don't reveal the surface exists. */
function NotFound() {
  return (
    <main className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 px-7 text-center">
      <ShieldAlert className="size-10 text-text-faint" aria-hidden />
      <h1 className="m-0 font-serif text-2xl font-semibold text-text">404 · 页面不存在</h1>
      <p className="text-sm text-text-muted">你访问的页面不存在或已被移除。</p>
    </main>
  )
}

export default AdminPage
