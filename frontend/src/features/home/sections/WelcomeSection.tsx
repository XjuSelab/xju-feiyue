import { useAuthStore } from '@/stores/authStore'

export function WelcomeSection() {
  const user = useAuthStore((s) => s.user)
  const mode = useAuthStore((s) => s.mode)
  return (
    <section aria-labelledby="welcome-heading" className="border-b border-border pb-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-faint">
        {mode === 'guest' ? 'Guest mode' : 'Feiyue'}
      </p>
      <h1
        id="welcome-heading"
        className="mt-1 font-serif text-4xl font-semibold leading-tight text-text"
      >
        {user ? `Hi ${user.name}，` : '新疆大学飞跃手册'}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
        飞跃，不只是一步跳远，而是迈向更远的未来 —— 本站愿与你一起"飞跃"。
      </p>
    </section>
  )
}
