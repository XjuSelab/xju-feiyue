import { useState } from 'react'
import { FileText, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CreditSummary } from './components/CreditSummary'
import { ModuleCard } from './components/ModuleCard'
import { RequirementChecklist } from './components/RequirementChecklist'
import { UploadCard } from './components/UploadCard'
import { parseTranscript } from './lib/parseTranscript'
import { loadTextItems } from './lib/pdf'
import { buildReport } from './lib/rules'
import type { CreditReport } from './types'

/** 学分统计页：上传成绩单 → 解析 → 各模块统计与达标检查。 */
export function CreditsPage() {
  const [report, setReport] = useState<CreditReport | null>(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    setLoading(true)
    try {
      const pages = await loadTextItems(file)
      const records = parseTranscript(pages)
      if (records.length === 0) {
        toast.error('未找到「通识选修·X模块」记录，请确认上传的是成绩明细 PDF')
        return
      }
      setReport(buildReport(records))
      setFileName(file.name)
      toast.success(`已解析 ${records.length} 门通识选修课程`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF 解析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      data-page="credits"
      className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10"
    >
      <header className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-text">学分统计</h1>
        <p className="text-sm text-text-muted">
          上传《学生成绩明细》PDF，自动统计通识选修各模块学分并检查是否符合学校要求。解析在本地浏览器完成，成绩数据不会上传。
        </p>
      </header>

      {!report ? (
        <UploadCard onFile={handleFile} loading={loading} />
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
