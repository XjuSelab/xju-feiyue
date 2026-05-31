import { useEffect, useState } from 'react'
import { getGreetings } from '@/api/endpoints/ai'
import { useAuthStore } from '@/stores/authStore'
import {
  familiarName,
  isValidGreeting,
  readCache,
  rotate,
  timeFallback,
  writeCache,
} from '@/features/home/lib/greeting'

export function WelcomeSection() {
  const user = useAuthStore((s) => s.user)
  const mode = useAuthStore((s) => s.mode)

  // 称呼优先取后端 preferred_name（注册派生 / 用户自定义），为空时本地派生。
  const addr = user ? (user.preferredName ?? familiarName(user.name)) : null

  // 首屏同步种子：有有效缓存则轮换取一条（回主页换下一条），否则即时本地时段兜底。
  // 永不出现请求在途空窗，永不闪「Hi 昵称」。
  const [line, setLine] = useState<string>(() => {
    if (!user || !addr) return ''
    const r = rotate(user.sid)
    if (r && isValidGreeting(r, addr)) return r
    return timeFallback(addr)
  })

  // 仅当缓存为空/过期时才请求一次（命中缓存靠 login 钩子预热，effect 不发请求）。
  // 失败全部静默——line 维持本地兜底。
  useEffect(() => {
    if (mode !== 'authed' || !user || !addr) return
    if (readCache(user.sid)) return
    const sid = user.sid
    getGreetings()
      .then((r) => {
        const valid = r.greetings.filter((g) => isValidGreeting(g, addr))
        if (!valid.length) return
        writeCache(sid, valid)
        const first = rotate(sid)
        if (first) setLine(first)
      })
      .catch(() => {})
  }, [user, addr, mode])

  // 双保险：缓存里若混入历史退化行，渲染前再过一次校验，退化则回本地兜底。
  const heading = user
    ? addr && line && isValidGreeting(line, addr)
      ? line
      : addr
        ? timeFallback(addr)
        : ''
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
