import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CATEGORIES } from '@/lib/categories'
import { cn } from '@/lib/cn'

const HOVER_OPEN_DELAY_MS = 200
const HOVER_CLOSE_DELAY_MS = 150

export function MegaMenu() {
  return (
    <>
      <DesktopMegaMenu />
      <MobileMegaMenu />
    </>
  )
}

function DesktopMegaMenu() {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
  }
  const scheduleOpen = () => {
    if (pinned) return
    clearTimers()
    openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS)
  }
  const scheduleClose = () => {
    if (pinned) return
    clearTimers()
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS)
  }
  const closeAll = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
    setPinned(false)
    setOpen(false)
  }, [])
  const togglePinned = () => {
    clearTimers()
    if (pinned) {
      setPinned(false)
      setOpen(false)
    } else {
      setPinned(true)
      setOpen(true)
    }
  }

  useEffect(() => () => clearTimers(), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        closeAll()
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, closeAll])

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Spec: Tab 聚焦「浏览」后 Enter/Space 切换 pinned 状态（与点击一致）。
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      togglePinned()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative hidden md:block"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-pressed={pinned}
        onClick={togglePinned}
        onKeyDown={onTriggerKey}
        className={cn(
          'inline-flex h-9 items-center rounded-sm px-3 text-sm font-medium transition',
          open ? 'bg-bg-subtle text-text' : 'text-text-muted hover:bg-bg-subtle hover:text-text',
        )}
      >
        浏览
      </button>

      <div
        role="dialog"
        aria-label="分类浏览"
        data-state={open ? 'open' : 'closed'}
        data-pinned={pinned ? 'true' : 'false'}
        onMouseEnter={() => {
          if (closeTimer.current) clearTimeout(closeTimer.current)
        }}
        onMouseLeave={scheduleClose}
        className={cn(
          'fixed left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-bg p-8 shadow-card transition-[opacity,transform] duration-200',
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0',
        )}
        style={{
          top: '64px',
          width: 'min(1080px, calc(100vw - 32px))',
        }}
      >
        <PanelContent onPick={closeAll} />
      </div>
    </div>
  )
}

function MobileMegaMenu() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="打开浏览菜单"
          className="inline-flex h-9 items-center rounded-sm px-3 text-sm font-medium text-text-muted transition hover:bg-bg-subtle hover:text-text md:hidden"
        >
          浏览
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] p-6">
        <SheetHeader>
          <SheetTitle>浏览</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <PanelContent onPick={() => setOpen(false)} mobile />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PanelContent({ onPick, mobile = false }: { onPick: () => void; mobile?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div className={cn('grid gap-4', mobile ? 'grid-cols-1' : 'grid-cols-4')}>
        {CATEGORIES.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.id}
              to={`/browse?cat=${c.id}`}
              data-cat={c.id}
              onClick={onPick}
              className="group flex h-24 items-center gap-3.5 overflow-hidden rounded-md px-4 py-3 outline-none transition hover:bg-bg-subtle focus-visible:ring-1 focus-visible:ring-border-strong"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-md"
                style={{
                  backgroundColor: `var(${c.tagBgVar})`,
                  color: `var(${c.colorVar})`,
                }}
              >
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-text">{c.label}</span>
                <span className="truncate text-xs text-text-muted">{c.desc}</span>
              </span>
            </Link>
          )
        })}
        <Link
          to="/browse"
          onClick={onPick}
          className="group flex h-24 items-center gap-3.5 overflow-hidden rounded-md bg-bg-subtle px-4 py-3 outline-none transition hover:bg-border focus-visible:ring-1 focus-visible:ring-border-strong"
        >
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-text text-white"
          >
            <LayoutGrid size={18} strokeWidth={1.75} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text">全部笔记</span>
            <span className="text-xs text-text-muted">查看所有分类</span>
          </span>
        </Link>
      </div>

      {!mobile && (
        <div className="grid grid-cols-3 gap-6 border-t border-border pt-6">
          <BottomList title="本周热门" />
          <BottomList title="高赞收藏" />
          <BottomList title="最新发布" />
        </div>
      )}
    </div>
  )
}

function BottomList({ title }: { title: string }) {
  return (
    <div>
      <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
        {title}
      </h4>
      <p className="text-xs text-text-muted">R4 home-agent 接通 useNotes 后展示</p>
    </div>
  )
}
