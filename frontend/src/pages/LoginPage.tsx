import { LoginForm } from '@/features/auth/LoginForm'
import { BrandPanel } from '@/features/auth/BrandPanel'

/**
 * Round 4 subagent D: 双栏 BrandPanel + LoginForm 替换 R3 minimum-viable
 * 表单。登录页不套 AppShell（router 中是 / 的 sibling 路由）。
 */
export function LoginPage() {
  return (
    <main
      data-page="login"
      className="grid min-h-screen grid-cols-1 lg:grid-cols-[480px_1fr]"
    >
      <BrandPanel />
      <div className="flex items-center justify-center bg-bg px-6 py-12">
        <LoginForm />
      </div>
    </main>
  )
}
