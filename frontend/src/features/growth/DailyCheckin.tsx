import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, useCheckin, type CheckIn } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LevelBadge } from './LevelBadge'

/** Per-user, per-local-day key so the prompt shows at most once a day. */
function promptKey(sid: string): string {
  const d = new Date()
  return `feiyue.checkin.${sid}.${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/**
 * Daily check-in modal, mounted app-wide. On the first authed render of a
 * local day it opens once (gated in localStorage). The user taps 一键签到 →
 * POST /auth/me/checkin (idempotent); the result updates the stored user's
 * exp/level so the level badge reflects immediately.
 */
export function DailyCheckin() {
  const user = useAuthStore((s) => s.user)
  const authed = useAuthStore((s) => s.mode) === 'authed'
  const patchUser = useAuthStore((s) => s.patchUser)
  const checkinMut = useCheckin()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<CheckIn | null>(null)

  useEffect(() => {
    if (!authed || !user) return
    const key = promptKey(user.sid)
    if (localStorage.getItem(key)) return // already prompted today
    localStorage.setItem(key, '1') // once per day, even if dismissed
    setResult(null)
    setOpen(true)
  }, [authed, user])

  if (!authed || !user) return null

  const onCheckin = () => {
    if (checkinMut.isPending) return
    checkinMut.mutate(undefined, {
      onSuccess: (r) => {
        setResult(r)
        patchUser({ exp: r.exp, level: r.level })
      },
      onError: (e) => {
        toast.error(e instanceof ApiError ? e.message : '签到失败，请稍后再试')
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">每日签到</DialogTitle>
          <DialogDescription className="text-center">
            {result
              ? result.alreadyCheckedIn
                ? '今天已经签过到啦，明天再来～'
                : `签到成功，经验 +${result.gainedExp}`
              : '签到领经验，连续签到不间断'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4">
          <LevelBadge level={result?.level ?? user.level ?? 0} className="scale-125" />
          <p className="text-sm text-text-muted">
            {result ? `已连续签到 ${result.streak} 天` : `当前 ${user.exp ?? 0} 经验`}
          </p>
          {result && (
            <p className="text-xs text-text-faint">
              当前 {result.exp} 经验 · Lv{result.level}
            </p>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button type="button" className="w-full" onClick={() => setOpen(false)}>
              开心收下
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={onCheckin}
              disabled={checkinMut.isPending}
            >
              {checkinMut.isPending ? '签到中…' : '一键签到（+5 经验）'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
