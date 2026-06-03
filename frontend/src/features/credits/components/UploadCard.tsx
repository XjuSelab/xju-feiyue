import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = {
  onFile: (file: File) => void
  loading: boolean
}

/** 成绩单 PDF 上传区：点击或拖拽，单文件。 */
export function UploadCard({ onFile, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const handleFiles = (files: FileList | null) => {
    const f = files && files[0]
    if (f) onFile(f)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setDrag(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          drag
            ? 'border-primary bg-primary/5'
            : 'border-border-strong bg-bg-subtle hover:bg-bg-hover',
          loading && 'cursor-wait opacity-70',
        )}
      >
        {loading ? (
          <Loader2 className="size-8 animate-spin text-text-muted" aria-hidden />
        ) : (
          <Upload className="size-8 text-text-muted" aria-hidden />
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium text-text">
            {loading ? '正在解析…' : '点击或拖拽上传成绩明细 PDF'}
          </p>
          <p className="text-xs text-text-faint">
            支持《学生成绩明细》PDF，解析在本地浏览器完成，不会上传
          </p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
