/* eslint-disable react-refresh/only-export-components --
 * router.tsx 同时 export `router` 配置和私有 helper 组件 (PageBoundary
 * / RouteFallback / RouteError)，这是路由层文件而非常规组件文件，
 * fast-refresh 对它的限制不适用。 */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAccess } from '@/components/layout/RequireAccess'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { ErrorState } from '@/components/common/ErrorState'

const HomePage = lazy(() =>
  import('@/pages/HomePage').then((m) => ({ default: m.HomePage })),
)
const BrowsePage = lazy(() =>
  import('@/pages/BrowsePage').then((m) => ({ default: m.BrowsePage })),
)
const WritePage = lazy(() =>
  import('@/pages/WritePage').then((m) => ({ default: m.WritePage })),
)
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const NoteDetailPage = lazy(() =>
  import('@/pages/NoteDetailPage').then((m) => ({
    default: m.NoteDetailPage,
  })),
)
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)

const DesignSystemPage = import.meta.env.DEV
  ? lazy(() =>
      import('@/pages/_dev/DesignSystemPage').then((m) => ({
        default: m.DesignSystemPage,
      })),
    )
  : null

function PageBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function RouteFallback() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <LoadingSkeleton preset="paragraph" count={1} />
    </div>
  )
}

function RouteError() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <ErrorState
        title="页面加载失败"
        message="请刷新页面重试。如果问题持续，请联系管理员。"
        onRetry={() => window.location.reload()}
      />
    </div>
  )
}

const devRoutes = DesignSystemPage
  ? [
      {
        path: '/_dev/design-system',
        element: (
          <PageBoundary>
            <DesignSystemPage />
          </PageBoundary>
        ),
      },
    ]
  : []

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PageBoundary>
        <LoginPage />
      </PageBoundary>
    ),
    errorElement: <RouteError />,
  },
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        path: '/',
        element: (
          <PageBoundary>
            <RequireAccess>
              <HomePage />
            </RequireAccess>
          </PageBoundary>
        ),
      },
      {
        path: '/browse',
        element: (
          <PageBoundary>
            <BrowsePage />
          </PageBoundary>
        ),
      },
      {
        path: '/write',
        element: (
          <PageBoundary>
            <RequireAccess requireAuth>
              <WritePage />
            </RequireAccess>
          </PageBoundary>
        ),
      },
      {
        path: '/write/:draftId',
        element: (
          <PageBoundary>
            <RequireAccess requireAuth>
              <WritePage />
            </RequireAccess>
          </PageBoundary>
        ),
      },
      {
        path: '/note/:id',
        element: (
          <PageBoundary>
            <NoteDetailPage />
          </PageBoundary>
        ),
      },
      {
        path: '/me',
        element: (
          <PageBoundary>
            <RequireAccess requireAuth>
              <ProfilePage />
            </RequireAccess>
          </PageBoundary>
        ),
      },
      ...devRoutes,
    ],
  },
])
