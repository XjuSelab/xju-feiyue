import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

type Props = {
  children: ReactNode
  /** 必须 authed 才能访问；guest/anon 都跳 /login */
  requireAuth?: boolean
  /** allowGuest=true（默认）允许 guest 模式访问；只对 requireAuth=false 生效 */
  allowGuest?: boolean
}

/**
 * 路由级访问守卫。
 *
 * | mode    | requireAuth=true | requireAuth=false / allowGuest=true | requireAuth=false / allowGuest=false |
 * | ------- | ---------------- | ----------------------------------- | ------------------------------------ |
 * | authed  | ✅                | ✅                                   | ✅                                    |
 * | guest   | ❌→/login         | ✅                                   | ❌→/login                             |
 * | anon    | ❌→/login         | ❌→/login                            | ❌→/login                             |
 *
 * 重定向时把当前 location 写入 state.from，登录页拿来 fallback redirect。
 */
export function RequireAccess({
  children,
  requireAuth = false,
  allowGuest = true,
}: Props) {
  const mode = useAuthStore((s) => s.mode)
  const location = useLocation()

  const isAuthed = mode === 'authed'
  const isGuest = mode === 'guest'
  const allowed = isAuthed || (isGuest && !requireAuth && allowGuest)

  if (!allowed) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    )
  }

  return <>{children}</>
}
