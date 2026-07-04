import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, GraduationCap, Users } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import { CommitteeBadge } from '@/components/common/CommitteeBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/stores/authStore'

import { GroupsTab } from './components/groups/GroupsTab'
import { MembersTab } from './components/MembersTab'
import { RollcallTab } from './components/rollcall/RollcallTab'
import { useClassMe } from './hooks/useClass'

/**
 * /class —— 班级空间。AppShell 之外的独立页面（无主站导航栏），仅 URL
 * 直达；顶部只留一条「返回 Feiyue」极简链接。三个 tab：小组（默认）/
 * 点名 / 成员；`?tab=` 同步到 URL（点名可深链）。未分配班级 → 空态。
 */
function BackToSiteBar() {
  const user = useAuthStore((s) => s.user)
  return (
    <div className="mb-4 flex items-center gap-3">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition hover:text-text"
      >
        <ArrowLeft size={14} aria-hidden />
        返回 Feiyue
      </Link>
      {user && (
        <>
          <span aria-hidden className="text-text-faint">
            ·
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Avatar className="size-6">
              {(user.avatarThumb ?? user.avatar) && (
                <AvatarImage src={resolveAssetUrl(user.avatarThumb ?? user.avatar ?? '')} alt="" />
              )}
              <AvatarFallback className="text-[10px]">{user.nickname.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm text-text">{user.nickname}</span>
          </span>
        </>
      )}
    </div>
  )
}

export function ClassPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'groups'
  const { data: me, isLoading, isError, refetch } = useClassMe()

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-7">
        <BackToSiteBar />
        <LoadingSkeleton preset="paragraph" count={3} />
      </main>
    )
  }
  if (isError || !me) {
    return (
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-7">
        <BackToSiteBar />
        <ErrorState title="班级信息加载失败" message="请稍后重试。" onRetry={() => void refetch()} />
      </main>
    )
  }

  if (!me.classFullName) {
    return (
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-7">
        <BackToSiteBar />
        <EmptyState
          icon={GraduationCap}
          title="你还没有加入班级"
          description="班级信息由管理员统一设置，请联系管理员将你加入所在班级。"
        />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-7">
      <BackToSiteBar />
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.01em] text-text">
          {me.classFullName}
        </h1>
        <Badge variant="secondary">{me.classShortName}</Badge>
        {me.isClassCommittee && <CommitteeBadge title={me.committeeTitle} className="text-xs" />}
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-text-muted">
          <Users size={15} strokeWidth={1.75} aria-hidden />
          {me.memberCount} 名成员
        </span>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setSearchParams(v === 'groups' ? {} : { tab: v }, { replace: true })
        }}
        className="w-full"
      >
        <TabsList className="mb-5">
          <TabsTrigger value="groups">小组</TabsTrigger>
          <TabsTrigger value="rollcall">点名</TabsTrigger>
          <TabsTrigger value="members">成员</TabsTrigger>
        </TabsList>

        <TabsContent value="groups">
          <GroupsTab />
        </TabsContent>
        <TabsContent value="rollcall">
          <RollcallTab isCommittee={me.isClassCommittee} />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab />
        </TabsContent>
      </Tabs>
    </main>
  )
}
