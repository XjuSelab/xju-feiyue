import {
  File as FileIcon,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  FileCode,
  FileArchive,
  Folder,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { kindOf, type FileKind } from '@/lib/fileTypes'

/**
 * FileTypeIcon —— 文件类型图标，单一来源由 `lib/fileTypes.kindOf` 驱动。
 *
 * 全部走 lucide 线性单色图标（与全站同一套笔触，简洁、不抢眼），靠 token 颜色
 * （`kindOf` 给出的 `text-cat-*`）区分类型，不用自绘的彩色折角文档块。
 *
 * 用法：
 *   <FileTypeIcon ext=".docx" />            // FileText（蓝）
 *   <FileTypeIcon ext="pdf" className="size-6" />
 *   <FileTypeIcon folder />                  // Folder
 *   <FileTypeIcon folder open />             // FolderOpen
 */

type Props = {
  /** 扩展名（带或不带前导点、大小写不敏感）。`folder` 为 true 时忽略。 */
  ext?: string
  /** 文件夹模式：渲染 lucide Folder / FolderOpen。 */
  folder?: boolean
  /** 文件夹展开态（仅 folder 模式生效）。 */
  open?: boolean
  /** 尺寸（px），作用于 lucide size。默认 24；也可用 className（如 `size-5`）。 */
  size?: number
  className?: string
}

/** kind → lucide 图标。颜色由 `kindOf().iconColorClass` 决定。 */
const LUCIDE_BY_KIND: Partial<Record<FileKind, LucideIcon>> = {
  word: FileText,
  excel: FileSpreadsheet,
  ppt: Presentation,
  pdf: FileText,
  image: FileImage,
  code: FileCode,
  archive: FileArchive,
  other: FileIcon,
}

export function FileTypeIcon({
  ext = '',
  folder = false,
  open = false,
  size = 24,
  className,
}: Props) {
  if (folder) {
    const Icon = open ? FolderOpen : Folder
    return (
      <Icon size={size} strokeWidth={1.75} aria-hidden className={cn('text-cat-course', className)} />
    )
  }

  const info = kindOf(ext)
  const Icon = LUCIDE_BY_KIND[info.kind] ?? FileIcon
  return (
    <Icon size={size} strokeWidth={1.75} aria-hidden className={cn(info.iconColorClass, className)} />
  )
}
