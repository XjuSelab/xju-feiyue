import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { GroupCreateInSchema, type GroupCreateIn } from '@/api/schemas/class'
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

import { useCreateGroup } from '../../hooks/useGroups'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024

/**
 * 创建小组 —— RHF + zodResolver（LoginForm 同款范式）。Logo 可选：
 * 选图后本地预览，提交时建组 → 链式上传（hook 内完成）。
 */
export function CreateGroupDialog({ open, onOpenChange }: Props) {
  const create = useCreateGroup()
  const fileRef = useRef<HTMLInputElement>(null)
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GroupCreateIn>({
    resolver: zodResolver(GroupCreateInSchema),
    defaultValues: { name: '', intro: '' },
  })

  // 打开沿 open 边缘重置（ProfileSettingsDialog 的 useEffect([open]) 习语）。
  useEffect(() => {
    if (open) {
      reset({ name: '', intro: '' })
      setLogo(null)
      setLogoError(null)
      setLogoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [open, reset])

  const onLogoSelected = (file: File | undefined) => {
    setLogoError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('仅支持图片文件')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logo 不能超过 2 MB')
      return
    }
    setLogo(file)
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const onSubmit = handleSubmit((body) => {
    create.mutate(
      { body, logo },
      {
        onSuccess: () => onOpenChange(false),
      },
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建小组</DialogTitle>
          <DialogDescription>你将成为组长，可审批同学的加入申请。</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid size-16 shrink-0 place-content-center overflow-hidden rounded-lg border border-dashed border-border text-text-muted transition hover:border-text-muted"
              aria-label="选择小组 Logo"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo 预览" className="size-16 object-cover" />
              ) : (
                <ImagePlus size={20} aria-hidden />
              )}
            </button>
            <div className="text-xs text-text-muted">
              <p className="m-0">小组 Logo（可选）</p>
              <p className="m-0">png / jpg / webp / gif，≤ 2 MB</p>
              {logoError && <p className="m-0 text-cat-research">{logoError}</p>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onLogoSelected(e.target.files?.[0])}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">组名</Label>
            <Input id="group-name" placeholder="如：飞跃小队" {...register('name')} />
            {errors.name && <p className="m-0 text-xs text-cat-research">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-intro">简要介绍（可选）</Label>
            <Textarea
              id="group-intro"
              rows={3}
              placeholder="一句话介绍小组目标 / 方向"
              {...register('intro')}
            />
            {errors.intro && (
              <p className="m-0 text-xs text-cat-research">{errors.intro.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? '创建中…' : '创建小组'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
