import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import { ApiError } from '@/api/client'

/**
 * Round 3 minimum-viable login（subagent D in R4 会替换为：
 *  - 双栏 BrandPanel + 7 类预览
 *  - RHF + zodResolver 校验
 *  - Sonner toast + inline 红字双重提示
 * ）。本轮要求功能性可用，验证 R3 串流测试。
 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const enterAsGuest = useAuthStore((s) => s.enterAsGuest)
  const mode = useAuthStore((s) => s.mode)
  const [sid, setSid] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  // 已登录的人访问 /login 直接回首页（effect 内 redirect，避免 render 期 side effect）
  useEffect(() => {
    if (mode === 'authed') {
      navigate(from, { replace: true })
    }
  }, [mode, from, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{8,12}$/.test(sid)) {
      toast.error('学号需 8-12 位纯数字')
      return
    }
    if (!password) {
      toast.error('密码不能为空')
      return
    }
    setSubmitting(true)
    try {
      await login(sid, password)
      toast.success('登录成功')
      navigate(from, { replace: true })
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : '登录失败，请稍后再试'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const onGuest = () => {
    enterAsGuest()
    navigate(from, { replace: true })
  }

  return (
    <main
      data-page="login"
      className="grid min-h-screen place-items-center bg-bg-subtle px-4"
    >
      <div className="w-full max-w-sm rounded-md border border-border bg-bg p-8 shadow-card">
        <div className="mb-6 text-center">
          <Link
            to="/"
            className="font-serif text-2xl font-semibold text-text"
          >
            LabNotes
          </Link>
          <p className="mt-1 text-xs text-text-muted">实验室经验共享</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="login-sid">学号</Label>
            <Input
              id="login-sid"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              value={sid}
              onChange={(e) => setSid(e.target.value)}
              placeholder="20210001"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">密码</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? '登录中…' : '登录'}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-text-faint">
          <span className="h-px flex-1 bg-border" />
          <span>或</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGuest}
        >
          以游客身份浏览
        </Button>

        <p className="mt-6 text-center text-xs text-text-faint">
          演示账号：20210001 / 123456
        </p>
      </div>
    </main>
  )
}
