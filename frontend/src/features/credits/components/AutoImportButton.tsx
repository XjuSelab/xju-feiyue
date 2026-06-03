import { useEffect, useState } from 'react'
import { Download, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { ImportWizard } from './ImportWizard'
import type { ImportPhase } from '../types'

/**
 * 「从教务系统自动导入」按钮（受控展示，状态机在 CreditsPage）。
 * - 点击 → 打开引导向导(ImportWizard)：检测脚本猫/导入脚本安装进度，逐级引导到教务导出。
 * - phase 全程动画：waiting(转圈「等待回传」) → received(绿色「已收到·解析中」直到出报告) → idle；
 *   超时/解析失败 → error(红色「重试」，再点重新打开向导)。
 * 用户在教务点【导入飞跃】回传后，切回本页由 CreditsPage 可见性轮询自动取回解析，向导随之关闭。
 */
export function AutoImportButton({
  phase,
  onStart,
  disabled,
}: {
  phase: ImportPhase
  onStart: () => void
  disabled?: boolean
}) {
  const [wizardOpen, setWizardOpen] = useState(false)

  // 收到回传 / 进入解析即收起向导（已经在出报告了）。
  useEffect(() => {
    if (phase === 'received') setWizardOpen(false)
  }, [phase])

  const busy = phase === 'waiting' || phase === 'received'

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {phase === 'error' ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setWizardOpen(true)}
          className="border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
        >
          <RotateCcw aria-hidden /> 导入失败 · 重试
        </Button>
      ) : busy ? (
        <Button
          type="button"
          variant="outline"
          disabled
          className={cn(
            'transition-colors disabled:opacity-100',
            phase === 'received' &&
              'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          )}
        >
          <Loader2 className="animate-spin" aria-hidden />
          {phase === 'received'
            ? '已收到成绩单 · 解析中…'
            : '等待教务系统回传…'}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => setWizardOpen(true)}
          disabled={disabled}
        >
          <Download aria-hidden /> 从教务系统自动导入
        </Button>
      )}

      <ImportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onGoExport={onStart}
      />
    </div>
  )
}
