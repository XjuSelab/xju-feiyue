import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AutoImportButton } from './components/AutoImportButton'
import { CreditSummary } from './components/CreditSummary'
import { ModuleCard } from './components/ModuleCard'
import { RequirementChecklist } from './components/RequirementChecklist'
import { UploadCard } from './components/UploadCard'
import { parseTranscript } from './lib/parseTranscript'
import { loadTextItems } from './lib/pdf'
import { buildReport } from './lib/rules'
import { fetchStashedTranscript } from './lib/stash'
import type { CreditReport, ImportPhase } from './types'

const POLL_MS = 2500
const TIMEOUT_MS = 180_000

/** 学分统计页：上传成绩单 → 解析 → 各模块统计与达标检查。 */
export function CreditsPage() {
  const [report, setReport] = useState<CreditReport | null>(null)
  const [fileName, setFileName] = useState('')
  // parsing：手动上传的解析中（UploadCard 转圈）；phase：自动导入按钮的全程动画状态。
  const [parsing, setParsing] = useState(false)
  const [phase, setPhase] = useState<ImportPhase>('idle')

  const busyRef = useRef(false) // 取件/解析进行中，防并发双取（取后即删）。
  const waitingRef = useRef(false) // 主动轮询中（点按钮后）。
  const deadlineRef = useRef(0)

  // 解析一份 PDF。fromAuto=true 走自动导入动画(received→解析完→idle/error)，
  // =false 走手动上传(parsing 布尔，错误不影响导入按钮)。
  const parse = useCallback(async (file: File, fromAuto: boolean) => {
    if (fromAuto) setPhase('received')
    else setParsing(true)
    try {
      const pages = await loadTextItems(file)
      const records = parseTranscript(pages)
      if (records.length === 0) {
        toast.error('未找到「通识选修·X模块」记录，请确认上传的是成绩明细 PDF')
        if (fromAuto) setPhase('error')
        return
      }
      setReport(buildReport(records))
      setFileName(file.name)
      toast.success(`已解析 ${records.length} 门通识选修课程`)
      if (fromAuto) setPhase('idle')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF 解析失败')
      if (fromAuto) setPhase('error')
    } finally {
      if (!fromAuto) setParsing(false)
    }
  }, [])

  const onManualFile = useCallback(
    (file: File) => {
      void parse(file, false)
    },
    [parse],
  )

  // 取回一次后端暂存件（脚本/书签刚回传的成绩单）；取到→解析。busyRef 防并发双取。
  const pickup = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false
    busyRef.current = true
    try {
      const file = await fetchStashedTranscript()
      if (!file) return false
      waitingRef.current = false // 取到即停主动轮询
      await parse(file, true)
      return true
    } catch {
      return false
    } finally {
      busyRef.current = false
    }
  }, [parse])

  // 被动取回：进页面 / 切回本标签页（可见或聚焦）时静默探一次；无暂存件就空跑。
  // 这样在教务页点完按钮、切回本标签页即「已收到·解析中」动画→出报告，无需脚本另开新标签。
  useEffect(() => {
    let alive = true
    const check = () => {
      if (!alive || document.visibilityState !== 'visible') return
      void pickup()
    }
    check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [pickup])

  // 主动轮询：点「从教务系统自动导入」后，留在本标签页也能等到回传；带超时。
  const startImport = useCallback(() => {
    waitingRef.current = true
    deadlineRef.current = Date.now() + TIMEOUT_MS
    setPhase('waiting')
    const tick = async () => {
      if (!waitingRef.current) return
      if (Date.now() > deadlineRef.current) {
        waitingRef.current = false
        setPhase('error')
        return
      }
      const got = await pickup() // 取到则 pickup 内已停轮询 + 走解析动画
      if (!got && waitingRef.current) window.setTimeout(tick, POLL_MS)
    }
    window.setTimeout(tick, POLL_MS)
  }, [pickup])

  // 卸载停轮询。
  useEffect(
    () => () => {
      waitingRef.current = false
    },
    [],
  )

  return (
    <section
      data-page="credits"
      className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold text-text">
            学分统计
          </h1>
          <p className="max-w-2xl text-sm text-text-muted">
            上传《学生成绩明细》PDF，自动统计通识选修各模块学分并检查是否符合学校要求。解析在本地浏览器完成，成绩数据不会上传。
          </p>
        </div>
        <AutoImportButton
          phase={phase}
          onStart={startImport}
          disabled={parsing}
        />
      </header>

      {!report ? (
        <UploadCard onFile={onManualFile} loading={parsing} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-text-muted">
              <FileText className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{fileName}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReport(null)
                setFileName('')
              }}
            >
              <RotateCcw aria-hidden /> 重新上传
            </Button>
          </div>

          <CreditSummary report={report} />

          <div>
            <h2 className="mb-3 text-sm font-semibold text-text">
              各模块选课明细
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {report.modules.map((m) => (
                <ModuleCard key={m.module} stat={m} />
              ))}
            </div>
          </div>

          <RequirementChecklist report={report} />
        </div>
      )}
    </section>
  )
}

export default CreditsPage
