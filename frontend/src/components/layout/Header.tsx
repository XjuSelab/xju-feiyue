import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Search, NotebookPen, LogOut, Settings, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/cn'
import { MegaMenu } from './MegaMenu'
import { ProfileSettingsDialog } from '@/features/settings/ProfileSettingsDialog'

export function Header() {
  const navigate = useNavigate()
  const mode = useAuthStore((s) => s.mode)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse')
  }

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-bg/95 px-6 backdrop-blur"
    >
      <Link
        to="/"
        className="flex items-center gap-2 font-medium text-text"
        aria-label="Feiyue 首页"
      >
        <NotebookPen size={18} strokeWidth={1.75} aria-hidden />
        <span className="font-serif text-base">Feiyue</span>
      </Link>

      <nav aria-label="主导航" className="flex items-center gap-1">
        <NavItem to="/" label="主页" />
        <MegaMenu />
        <NavItem to="/write" label="写作" />
      </nav>

      <form role="search" onSubmit={onSearch} className="ml-auto flex w-60 max-w-full items-center">
        <label htmlFor="header-search" className="sr-only">
          搜索笔记
        </label>
        <div className="relative w-full">
          <Search
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            id="header-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索笔记 / 作者 / 标签"
            className="h-8 pl-7 text-sm"
          />
        </div>
      </form>

      {mode === 'authed' && user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="账户菜单"
              className="inline-flex size-8 items-center justify-center rounded-full bg-bg-subtle text-sm font-medium text-text transition hover:bg-border"
            >
              {user.avatarThumb || user.avatar ? (
                <img
                  src={user.avatarThumb ?? user.avatar ?? ''}
                  alt={user.nickname}
                  className="size-full rounded-full object-cover"
                />
              ) : (
                user.nickname.slice(0, 2).toUpperCase()
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm">{user.nickname}</span>
              <span className="text-xs text-text-faint">{user.sid}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/me" className="flex w-full items-center gap-2">
                <UserIcon size={14} aria-hidden /> 我的笔记
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault()
                setSettingsOpen(true)
              }}
              className="flex items-center gap-2"
            >
              <Settings size={14} aria-hidden /> 设置
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="text-cat-research focus:text-cat-research"
            >
              <LogOut size={14} aria-hidden /> 退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          {mode === 'guest' && (
            <Badge variant="secondary" className="text-xs">
              游客
            </Badge>
          )}
          <Button asChild size="sm" variant="default">
            <Link to="/login">登录</Link>
          </Button>
        </div>
      )}
      <ProfileSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  )
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'inline-flex h-9 items-center rounded-sm px-3 text-sm font-medium transition',
          isActive
            ? 'bg-bg-subtle text-text'
            : 'text-text-muted hover:bg-bg-subtle hover:text-text',
        )
      }
    >
      {label}
    </NavLink>
  )
}
