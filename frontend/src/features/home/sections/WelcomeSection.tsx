import { useQuery } from '@tanstack/react-query'
import { getGreeting } from '@/api/endpoints/ai'
import { useAuthStore } from '@/stores/authStore'

export function WelcomeSection() {
  const user = useAuthStore((s) => s.user)
  const mode = useAuthStore((s) => s.mode)

  // 登录用户：个性化一句话问候（后端结合 称呼/时间/天气 由模型生成）。
  // 首次进入还没返回、或调用超时/失败时，heading 回退到简单的 `Hi <昵称>，`，
  // 问候到达后再无感替换；游客显示站点标语。
  const greeting = useQuery({
    queryKey: ['home-greeting'],
    queryFn: getGreeting,
    enabled: mode === 'authed' && !!user,
    staleTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const heading = user
    ? greeting.data?.text || `Hi ${user.nickname}，`
    : '新疆大学飞跃手册'

  return (
    <section aria-labelledby="welcome-heading" className="border-b border-border pb-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-faint">
        {mode === 'guest' ? 'Guest mode' : 'Feiyue'}
      </p>
      <h1
        id="welcome-heading"
        className="mt-1 font-serif text-4xl font-semibold leading-tight text-text"
      >
        {heading}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
        飞跃，不只是一步跳远，而是迈向更远的未来 —— 本站愿与你一起“飞跃”。
      </p>
    </section>
  )
}
