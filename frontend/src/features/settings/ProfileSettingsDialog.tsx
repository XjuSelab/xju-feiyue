import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import * as authApi from '@/api/endpoints/auth'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/authStore'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * ProfileSettingsDialog — header dropdown 里的「设置」入口。
 *
 * 内容分两块：
 *   - 头像 + 个人信息（nickname/name/wechat/phone/email/bio） PATCH /auth/me
 *   - 修改密码 — POST /auth/me/password
 *
 * sid 只展示不可改（学号是 PK）。头像走 /auth/me/avatar 文件上传，URL 回填
 * 到 user.avatar 后立即更新本地 store，所以右上角 chip 也会同步。
 */
export function ProfileSettingsDialog({ open, onOpenChange }: Props) {
  const user = useAuthStore((s) => s.user)
  const setUser = (u: NonNullable<typeof user>) => useAuthStore.setState((s) => ({ ...s, user: u }))

  const [nickname, setNickname] = useState('')
  const [name, setName] = useState('')
  const [wechat, setWechat] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hydrate form fields ONLY on the false→true edge of `open`. If we
  // re-ran whenever `user` changed (e.g. after an avatar upload while
  // the dialog is still open) any in-progress edits in the text fields
  // would silently get clobbered with the stored values.
  useEffect(() => {
    if (!open || !user) return
    setNickname(user.nickname)
    setName(user.name)
    setWechat(user.wechat ?? '')
    setPhone(user.phone ?? '')
    setEmail(user.email ?? '')
    setBio(user.bio ?? '')
    setCurrentPassword('')
    setNewPassword('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!user) return null

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Only send fields that changed — keeps the PATCH body tight and
      // avoids accidentally clobbering with empty strings.
      const patch: Record<string, string> = {}
      if (nickname !== user.nickname) patch.nickname = nickname.trim()
      if (name !== user.name) patch.name = name.trim()
      if (wechat !== (user.wechat ?? '')) patch.wechat = wechat.trim()
      if (phone !== (user.phone ?? '')) patch.phone = phone.trim()
      if (email !== (user.email ?? '')) patch.email = email.trim()
      if (bio !== (user.bio ?? '')) patch.bio = bio.trim()

      const changed = Object.keys(patch).length > 0
      if (changed) {
        const next = await authApi.updateMe(patch)
        setUser(next)
      }
      onOpenChange(false)
      // Defer the toast to a fresh microtask AFTER dialog teardown
      // — Radix's close cleanup can swallow toasts otherwise.
      if (changed) {
        setTimeout(() => toast.success('已保存'), 0)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const onPickAvatar = () => fileInputRef.current?.click()

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // allow re-picking the same file
    setUploadingAvatar(true)
    try {
      const next = await authApi.uploadAvatar(file)
      setUser(next)
      toast.success('头像已更新')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '头像上传失败')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const onChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('当前密码与新密码都需填写')
      return
    }
    if (newPassword.length < 6) {
      toast.error('新密码至少 6 位')
      return
    }
    setChangingPwd(true)
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      toast.success('密码已修改')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '密码修改失败')
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>个人设置</DialogTitle>
          <DialogDescription>
            学号是注册时绑定的不可修改；昵称改完后笔记卡上立即生效。
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSave}>
          <div className="flex items-center gap-4">
            <span className="inline-flex size-14 items-center justify-center overflow-hidden rounded-full bg-bg-subtle text-base font-medium text-text">
              {user.avatar ? (
                <img src={user.avatar} alt="头像" className="size-full object-cover" />
              ) : (
                user.nickname.slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPickAvatar}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? '上传中…' : '更换头像'}
              </Button>
              <p className="text-xs text-text-faint">png / jpg / webp ≤ 2 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={onAvatarSelected}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="settings-sid">学号</Label>
              <Input id="settings-sid" value={user.sid} disabled readOnly />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-nickname">昵称</Label>
              <Input
                id="settings-nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-name">姓名</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-wechat">微信</Label>
              <Input
                id="settings-wechat"
                value={wechat}
                onChange={(e) => setWechat(e.target.value)}
                placeholder="微信号"
                maxLength={64}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-phone">手机号</Label>
              <Input
                id="settings-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 位手机号"
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-email">邮箱</Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={128}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="settings-bio">个人简介</Label>
            <Textarea
              id="settings-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-medium">修改密码</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="settings-old-pwd">当前密码</Label>
              <Input
                id="settings-old-pwd"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-new-pwd">新密码</Label>
              <Input
                id="settings-new-pwd"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onChangePassword}
            disabled={changingPwd}
          >
            {changingPwd ? '提交中…' : '更新密码'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
