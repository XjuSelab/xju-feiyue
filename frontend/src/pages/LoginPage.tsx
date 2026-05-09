import { LoginForm } from '@/features/auth/LoginForm'
import { BrandPanel } from '@/features/auth/BrandPanel'

/**
 * Round 5 redesign — direction B (brand-hero with note card stack):
 * 12-col grid, 7/5 split on lg+; mobile 单栏（BrandPanel hidden lg:flex）。
 */
export function LoginPage() {
  return (
    <main data-page="login" className="grid min-h-screen grid-cols-1 lg:grid-cols-12">
      <BrandPanel />
      <section className="flex items-center justify-center bg-bg px-6 py-12 lg:col-span-5">
        <LoginForm />
      </section>
    </main>
  )
}
