import { Download, Trash2 } from 'lucide-react'

import type { GroupFile } from '@/api/schemas/class'
import { FileTypeIcon } from '@/components/common/FileTypeIcon'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

type Props = {
  file: GroupFile
  onPreview: (f: GroupFile) => void
  onDownload: (f: GroupFile) => void
  onDelete?: ((f: GroupFile) => void) | undefined
  /** 隐藏「上传者·日期」列（卡片按上传者分组时冗余）。 */
  hideUploader?: boolean | undefined
}

/**
 * 单个文件行 —— 列表视图与卡片展开面板共用。图标 + 文件名（点击预览）+
 * 体积 + 上传者·日期 + hover 显现的下载/删除。下载走回调（fetch→blob，
 * 见 downloadGroupFile），不再用 `<a href>` 导航（会丢 auth header → 401）。
 */
export function FileRow({ file, onPreview, onDownload, onDelete, hideUploader }: Props) {
  return (
    <li className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-bg-subtle">
      <FileTypeIcon ext={file.ext ?? ''} size={18} className="size-[18px] shrink-0" />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-sm text-text hover:underline"
        onClick={() => onPreview(file)}
      >
        {file.name}
      </button>
      <span className="shrink-0 text-xs tabular-nums text-text-faint">{file.size}</span>
      {!hideUploader && (
        <span className="hidden shrink-0 text-xs text-text-faint sm:inline">
          {file.uploadedByNickname} · {formatDate(file.createdAt)}
        </span>
      )}
      <button
        type="button"
        onClick={() => onDownload(file)}
        className="shrink-0 rounded p-1 text-text-muted opacity-0 transition hover:text-text group-hover:opacity-100"
        aria-label={`下载 ${file.name}`}
      >
        <Download size={14} aria-hidden />
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(file)}
          className="shrink-0 rounded p-1 text-text-muted opacity-0 transition hover:text-cat-research group-hover:opacity-100"
          aria-label={`删除 ${file.name}`}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </li>
  )
}
