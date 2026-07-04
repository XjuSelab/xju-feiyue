import { useState } from 'react'
import { Pencil } from 'lucide-react'

import type { GroupDetail } from '@/api/schemas/class'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import { useUpdateGroup } from '../../hooks/useGroups'

type Props = {
  group: GroupDetail
  canEdit: boolean
}

/** 简要介绍 —— 读视图 + 组长/班委行内编辑（Textarea 就地展开）。 */
export function GroupIntro({ group, canEdit }: Props) {
  const update = useUpdateGroup(group.id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    setDraft(group.intro)
    setEditing(true)
  }
  const save = () => {
    update.mutate({ intro: draft }, { onSuccess: () => setEditing(false) })
  }

  return (
    <section aria-label="小组简介" className="rounded-lg border border-border bg-bg p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="m-0 text-sm font-semibold text-text">简介</h2>
        {canEdit && !editing && (
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={startEdit}>
            <Pencil size={13} aria-hidden className="mr-1" />
            编辑
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="介绍一下小组的目标、分工、进展…"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              取消
            </Button>
            <Button size="sm" onClick={save} disabled={update.isPending}>
              {update.isPending ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      ) : group.intro ? (
        <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
          {group.intro}
        </p>
      ) : (
        <p className="m-0 text-sm text-text-faint">
          {canEdit ? '还没有简介，点「编辑」写一段吧。' : '还没有简介。'}
        </p>
      )}
    </section>
  )
}
