import { useAuthStore } from '@/stores/authStore'

export function WelcomeSection() {
  const user = useAuthStore((s) => s.user)
  const mode = useAuthStore((s) => s.mode)
  return (
    <section
      aria-labelledby="welcome-heading"
      className="border-b border-border pb-10"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-text-faint">
        {mode === 'guest' ? 'Guest mode' : 'LabNotes'}
      </p>
      <h1
        id="welcome-heading"
        className="mt-1 font-serif text-4xl font-semibold leading-tight text-text"
      >
        {user ? `Hi ${user.name}，` : '实验室经验共享'}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
        Notion 极简白的外壳，Claude 导出 PDF 的内容质感。把今天的实验日志、
        Kaggle 复盘、读书笔记，写成下次能直接抄的作业。
      </p>
    </section>
  )
}
