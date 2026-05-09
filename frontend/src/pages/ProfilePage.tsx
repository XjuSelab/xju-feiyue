import { useAuthStore } from '@/stores/authStore'

/**
 * Round 3 placeholder. R4+ 接「我发表的笔记」「我点赞的笔记」「设置」三 Tab。
 */
export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  return (
    <section data-page="profile" className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-serif text-2xl font-semibold text-text">
        我的笔记
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        ProfilePage placeholder · {user?.name ?? '(no user)'}
      </p>
    </section>
  )
}
