import { useState } from 'react'
import { Plus } from 'lucide-react'

import type { GroupMember, GroupTask, TaskCreateIn } from '@/api/schemas/class'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'

import { useCreateTask, useDeleteTask, useGroupTasks, useUpdateTask } from '../../hooks/useGroupTasks'
import { addDays } from '../../lib/gantt'
import { GanttChart } from './GanttChart'
import { TaskFormDialog } from './TaskFormDialog'

type Props = {
  gid: string
  members: GroupMember[]
  canEdit: boolean
  currentSid: string
  canManage: boolean
}

/**
 * 甘特面板 —— 数据 + 弹窗编排：工具栏新建、点条编辑、拖移平移日期
 * （useUpdateTask 乐观，松手即生效）。删除权限：创建者或组长/班委。
 */
export function GanttPanel({ gid, members, canEdit, currentSid, canManage }: Props) {
  const { data: tasks, isLoading } = useGroupTasks(gid, true)
  const createTask = useCreateTask(gid)
  const updateTask = useUpdateTask(gid)
  const deleteTask = useDeleteTask(gid)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GroupTask | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (task: GroupTask) => {
    setEditing(task)
    setFormOpen(true)
  }

  const onSubmit = (body: TaskCreateIn) => {
    if (editing) {
      updateTask.mutate(
        { tid: editing.id, body },
        { onSuccess: () => setFormOpen(false) },
      )
    } else {
      createTask.mutate(body, { onSuccess: () => setFormOpen(false) })
    }
  }

  const onDelete = () => {
    if (!editing) return
    deleteTask.mutate(editing.id, { onSuccess: () => setFormOpen(false) })
  }

  const onMoveTask = (task: GroupTask, deltaDays: number) => {
    updateTask.mutate({
      tid: task.id,
      body: {
        startDate: addDays(task.startDate, deltaDays),
        endDate: addDays(task.endDate, deltaDays),
      },
    })
  }

  const canDeleteEditing =
    editing != null && (canManage || editing.createdBySid === currentSid)

  return (
    <section aria-label="任务甘特图" className="rounded-lg border border-border bg-bg p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="m-0 text-sm font-semibold text-text">任务分配</h2>
        <span className="text-xs text-text-faint">{tasks?.length ?? 0} 个任务</span>
        {canEdit && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={openCreate}>
            <Plus size={14} aria-hidden className="mr-1.5" />
            新建任务
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton preset="paragraph" count={2} />
      ) : !tasks || tasks.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-text-faint">
          还没有任务 —— 点「新建任务」开始分配。
        </p>
      ) : (
        <>
          <GanttChart
            tasks={tasks}
            canEdit={canEdit}
            onBarClick={openEdit}
            onMoveTask={onMoveTask}
          />
          {canEdit && (
            <p className="m-0 mt-2 text-xs text-text-faint">
              点击任务条编辑；按住左右拖动可整体平移日期。
            </p>
          )}
        </>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        members={members}
        task={editing}
        canDelete={canDeleteEditing}
        onSubmit={onSubmit}
        onDelete={onDelete}
        isSaving={createTask.isPending || updateTask.isPending}
      />
    </section>
  )
}
