import * as React from 'react'
import { Plus } from 'lucide-react'

import type { AdminUserRow } from '@/api/schemas/admin'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useAdminClasses, useCreateClass, useSetUserClass } from '../hooks/useAdmin'

type Props = {
  user: AdminUserRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Select 哨兵值（Radix Select 不接受空串 value）。 */
const NONE_VALUE = '__none__'

/**
 * 设置班级 —— 从已有班级下拉选择（保证同班同学班级名一致，点名/小组
 * 才聚得拢），内联「新建班级」双输入；「移除班级」发送 null（同时清班委，
 * 后端保证）。
 */
export function SetClassDialog({ user, open, onOpenChange }: Props) {
  const { data: classes, isLoading } = useAdminClasses(open)
  const setClass = useSetUserClass()
  const createClass = useCreateClass()

  const [selected, setSelected] = React.useState<string>(NONE_VALUE)
  const [creating, setCreating] = React.useState(false)
  const [fullName, setFullName] = React.useState('')
  const [shortName, setShortName] = React.useState('')

  // 打开沿 open 边缘用目标用户当前班级回填。
  React.useEffect(() => {
    if (!open) return
    setSelected(user?.classId != null ? String(user.classId) : NONE_VALUE)
    setCreating(false)
    setFullName('')
    setShortName('')
  }, [open, user])

  if (!user) return null

  const onCreateClass = () => {
    if (!fullName.trim() || !shortName.trim()) return
    createClass.mutate(
      { fullName: fullName.trim(), shortName: shortName.trim() },
      {
        onSuccess: (row) => {
          setSelected(String(row.id))
          setCreating(false)
        },
      },
    )
  }

  const onSave = () => {
    const classId = selected === NONE_VALUE ? null : Number(selected)
    setClass.mutate({ sid: user.sid, classId }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">设置班级</DialogTitle>
          <DialogDescription>
            为 <strong>{user.nickname}</strong>（{user.sid}）指定班级；移除班级会同时取消其班委。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>班级</Label>
            <Select value={selected} onValueChange={setSelected} disabled={isLoading}>
              <SelectTrigger aria-label="选择班级">
                <SelectValue placeholder="选择班级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>未分配（移除班级）</SelectItem>
                {(classes ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}（{c.shortName} · {c.studentCount} 人）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {creating ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-subtle p-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-class-full">班级全名</Label>
                <Input
                  id="new-class-full"
                  placeholder="计算机科学与技术24-3"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-class-short">班级简名</Label>
                <Input
                  id="new-class-short"
                  placeholder="计算机24-3"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={onCreateClass}
                  disabled={createClass.isPending || !fullName.trim() || !shortName.trim()}
                >
                  {createClass.isPending ? '创建中…' : '创建并选中'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} aria-hidden className="mr-1" />
              新建班级
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSave} disabled={setClass.isPending}>
            {setClass.isPending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
