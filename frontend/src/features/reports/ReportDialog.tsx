import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError, REPORT_REASONS, useCreateReport, type ReportReason } from '@/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  targetType: 'note' | 'comment'
  targetId: string
}

/** Reusable report dialog for a note or comment. */
export function ReportDialog({ open, onOpenChange, targetType, targetId }: Props) {
  const createReport = useCreateReport()
  const [reason, setReason] = useState<ReportReason>('spam')
  const [description, setDescription] = useState('')

  const onSubmit = () => {
    if (createReport.isPending) return
    createReport.mutate(
      { targetType, targetId, reason, ...(description.trim() ? { description: description.trim() } : {}) },
      {
        onSuccess: () => {
          toast.success('举报已提交，感谢反馈')
          onOpenChange(false)
          setDescription('')
          setReason('spam')
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : '举报失败'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>举报{targetType === 'note' ? '笔记' : '评论'}</DialogTitle>
          <DialogDescription>选择举报理由，管理员会尽快审核。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition',
                reason === r.value
                  ? 'border-text bg-text text-bg'
                  : 'border-border text-text-muted hover:border-border-strong',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="补充说明（可选）"
          rows={3}
          maxLength={1000}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createReport.isPending}
          >
            取消
          </Button>
          <Button type="button" onClick={onSubmit} disabled={createReport.isPending}>
            {createReport.isPending ? '提交中…' : '提交举报'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
