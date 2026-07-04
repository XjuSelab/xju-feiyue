import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'

import {
  TaskCreateInSchema,
  type GroupMember,
  type GroupTask,
  type TaskCreateIn,
} from '@/api/schemas/class'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'

import { STATUS_META, STATUS_ORDER } from '../../data'
import { addDays, todayStr } from '../../lib/gantt'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: GroupMember[]
  /** null = 新建；非 null = 编辑该任务。 */
  task: GroupTask | null
  canDelete: boolean
  onSubmit: (body: TaskCreateIn) => void
  onDelete: () => void
  isSaving: boolean
}

/**
 * 任务表单 —— RHF + zodResolver（LoginForm 范式）。负责人 = 组员 Checkbox
 * 多选；起止用原生 `input[type=date]`（无日历依赖）；状态改「已完成」时
 * 进度自动补 100。编辑态提供 AlertDialog 确认删除。
 */
export function TaskFormDialog({
  open,
  onOpenChange,
  members,
  task,
  canDelete,
  onSubmit,
  onDelete,
  isSaving,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskCreateIn>({
    resolver: zodResolver(TaskCreateInSchema),
    defaultValues: {
      title: '',
      description: '',
      assigneeSids: [],
      startDate: todayStr(),
      endDate: addDays(todayStr(), 6),
      status: 'todo',
      progress: 0,
    },
  })

  useEffect(() => {
    if (!open) return
    if (task) {
      reset({
        title: task.title,
        description: task.description,
        assigneeSids: task.assigneeSids,
        startDate: task.startDate,
        endDate: task.endDate,
        status: task.status,
        progress: task.progress,
      })
    } else {
      reset({
        title: '',
        description: '',
        assigneeSids: [],
        startDate: todayStr(),
        endDate: addDays(todayStr(), 6),
        status: 'todo',
        progress: 0,
      })
    }
    setConfirmDelete(false)
  }, [open, task, reset])

  const assigneeSids = watch('assigneeSids')
  const status = watch('status')

  const toggleAssignee = (sid: string, checked: boolean) => {
    const next = checked
      ? [...assigneeSids, sid]
      : assigneeSids.filter((s) => s !== sid)
    setValue('assigneeSids', next, { shouldValidate: false })
  }

  const submit = handleSubmit((body) => onSubmit(body))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? '编辑任务' : '新建任务'}</DialogTitle>
          <DialogDescription>
            任务在甘特图中按起止日期渲染，负责人须是小组成员。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">标题</Label>
            <Input id="task-title" placeholder="如：需求分析" {...register('title')} />
            {errors.title && (
              <p className="m-0 text-xs text-cat-research">{errors.title.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-desc">说明（可选）</Label>
            <Textarea id="task-desc" rows={2} {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-start">开始日期</Label>
              <Input id="task-start" type="date" {...register('startDate')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-end">结束日期</Label>
              <Input id="task-end" type="date" {...register('endDate')} />
              {errors.endDate && (
                <p className="m-0 text-xs text-cat-research">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>负责人</Label>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
              {members.map((m) => (
                <li key={m.sid}>
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm text-text">
                    <Checkbox
                      checked={assigneeSids.includes(m.sid)}
                      onCheckedChange={(v) => toggleAssignee(m.sid, v === true)}
                    />
                    {m.nickname}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>状态</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setValue('status', v as TaskCreateIn['status'])
                  // 「已完成」约定进度补满。
                  if (v === 'done') setValue('progress', 100)
                }}
              >
                <SelectTrigger aria-label="任务状态">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-progress">进度（%）</Label>
              <Input
                id="task-progress"
                type="number"
                min={0}
                max={100}
                {...register('progress', { valueAsNumber: true })}
              />
              {errors.progress && (
                <p className="m-0 text-xs text-cat-research">{errors.progress.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            {task && canDelete && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto text-cat-research"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} aria-hidden className="mr-1" />
                删除
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '保存中…' : task ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </form>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除任务「{task?.title}」？</AlertDialogTitle>
              <AlertDialogDescription>此操作不可恢复。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmDelete(false)
                  onDelete()
                }}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
