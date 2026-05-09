import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import { LoginRequestSchema, type LoginRequest } from '@/api/schemas/user'
import { ApiError } from '@/api/client'

export function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const enterAsGuest = useAuthStore((s) => s.enterAsGuest)
  const mode = useAuthStore((s) => s.mode)

  const form = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { sid: '', password: '' },
    mode: 'onTouched',
  })
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = form

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  // 已登录用户访问 /login 直接 redirect
  useEffect(() => {
    if (mode === 'authed') {
      navigate(from, { replace: true })
    }
  }, [mode, from, navigate])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values.sid, values.password)
      toast.success('登录成功')
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '登录失败，请稍后再试'
      toast.error(msg)
      setError('password', { type: 'server', message: msg })
    }
  })

  const onGuest = () => {
    enterAsGuest()
    toast.message('已进入游客模式', { description: '部分功能需登录后使用。' })
    navigate(from, { replace: true })
  }

  return (
    <div className="w-full max-w-[408px] rounded-lg border border-border bg-bg p-10 shadow-card">
      <h2 className="select-none font-serif text-[32px] font-semibold leading-[1.15] text-text">
        登录
      </h2>
      <p className="mt-2 select-none text-[15px] leading-[1.5] text-text-muted">
        用学号登录开始记录。
      </p>

      <form className="mt-8 space-y-4" noValidate onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="login-sid" className="select-none text-[13px]">
            学号
          </Label>
          <Input
            id="login-sid"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            placeholder="20211010001"
            maxLength={11}
            className="h-11 rounded-md text-base"
            aria-invalid={!!errors.sid}
            aria-describedby={errors.sid ? 'login-sid-err' : undefined}
            {...register('sid')}
          />
          {errors.sid && (
            <p id="login-sid-err" role="alert" className="select-none text-xs text-cat-research">
              {errors.sid.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-password" className="select-none text-[13px]">
            密码
          </Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••"
            className="h-11 rounded-md text-base"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'login-password-err' : undefined}
            {...register('password')}
          />
          {errors.password && (
            <p
              id="login-password-err"
              role="alert"
              className="select-none text-xs text-cat-research"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full rounded-md text-[15px]"
          disabled={isSubmitting}
        >
          {isSubmitting ? '登录中…' : '登录'}
        </Button>
      </form>

      <div className="my-5 flex select-none items-center gap-3 text-xs text-text-faint">
        <span className="h-px flex-1 bg-border" />
        <span>或</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full rounded-md text-[15px]"
        onClick={onGuest}
      >
        以游客身份浏览
      </Button>

      <p className="mt-6 text-center text-[12.5px] text-text-faint">
        <span className="select-none">演示账号：</span>
        <span className="select-text font-mono">20211010001 / 123456</span>
      </p>
    </div>
  )
}
