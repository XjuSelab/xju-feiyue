import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * 框架壳：Header + 路由 Outlet + Footer。
 * Login 页不套 AppShell（router.tsx 中以 sibling 路由声明）。
 */
export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
