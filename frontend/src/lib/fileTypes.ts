/**
 * 文件类型单一数据源 —— 被「写作栏附件」(FileCard / FilePreviewDialog) 与
 * 「资料」页 (PreviewPane / FileTree) 共同消费。
 *
 * 设计要点：
 * - 扩展名集合是唯一权威；MIME (`File.type`) 仅作旁证，Windows 拖入的 office
 *   文件常常 `type === ''`，所以判定一律「优先扩展名、MIME 兜底」。
 * - `kindOf` 把扩展名归一到 8 类视觉/语义 kind，附带 tailwind token class
 *   （只用 `text-cat-*` / `bg-tag-*`，禁硬编码颜色）。
 * - `previewKind` 决定共享 viewer 的分发；`isPreviewable` 判断是否可在线预览。
 * - `isAttachmentHref` 在 Markdown `components.a` 里把附件链接识别成 FileCard。
 */

/** 旧版二进制 Word（.doc）+ OOXML Word（.docx）。 */
export const WORD_EXTS = ['.doc', '.docx'] as const
/** Excel：旧版 .xls + OOXML .xlsx。 */
export const EXCEL_EXTS = ['.xls', '.xlsx'] as const
/** PowerPoint：旧版 .ppt + OOXML .pptx。 */
export const PPT_EXTS = ['.ppt', '.pptx'] as const
/** PDF。 */
export const PDF_EXTS = ['.pdf'] as const

/**
 * 文档类扩展名总集 —— 上传 allowlist + `isAttachmentHref` 的判定依据。
 * 显式不含 `.svg/.html/.htm/.xml`（浏览器会当页面执行 → XSS）。
 */
export const DOC_EXTS = [
  ...WORD_EXTS,
  ...EXCEL_EXTS,
  ...PPT_EXTS,
  ...PDF_EXTS,
] as const

/** 图片扩展名（写作栏图片走 `![](url)`，与 doc 分流）。 */
export const IMAGE_EXTS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.bmp',
] as const

/** 代码 / 纯文本扩展名 —— 资料页用 highlight.js 预览。 */
export const CODE_EXTS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.csv',
  '.log',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.hpp',
  '.cs',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.xml',
  '.vue',
  '.svelte',
  '.kt',
  '.swift',
  '.r',
  '.m',
  '.scala',
  '.lua',
  '.dart',
] as const

/** 压缩包扩展名。 */
export const ARCHIVE_EXTS = [
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
] as const

/** 上传上限统一 50MB（与后端 MAX_UPLOAD_BYTES 对齐）。 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export type FileKind =
  | 'word'
  | 'excel'
  | 'ppt'
  | 'pdf'
  | 'image'
  | 'code'
  | 'archive'
  | 'other'

export type PreviewKind = 'pdf' | 'docx' | 'xlsx' | 'image' | 'code' | 'unsupported'

export type FileKindInfo = {
  kind: FileKind
  /** 中文展示标签（badge / 无障碍）。 */
  label: string
  /** lucide 图标 currentColor 的 token class，例如 `text-cat-kaggle`。 */
  iconColorClass: string
  /** 图标底座 12% tint 的 token class，例如 `bg-tag-kaggle`。 */
  tileBgClass: string
}

const WORD_SET = new Set<string>(WORD_EXTS)
const EXCEL_SET = new Set<string>(EXCEL_EXTS)
const PPT_SET = new Set<string>(PPT_EXTS)
const PDF_SET = new Set<string>(PDF_EXTS)
const DOC_SET = new Set<string>(DOC_EXTS)
const IMAGE_SET = new Set<string>(IMAGE_EXTS)
const CODE_SET = new Set<string>(CODE_EXTS)
const ARCHIVE_SET = new Set<string>(ARCHIVE_EXTS)

/**
 * 从 URL / 文件名提取小写扩展名（含点，如 `.pdf`）。
 * - 处理 `?query` / `#hash`：先剥掉。
 * - 处理 URL 编码（`%2Edocx`）：尽力 decode，失败回退原串。
 * - 只取最后一段路径的最后一个点之后；无扩展名返回 ''。
 */
export function extOf(url: string): string {
  if (!url) return ''
  // 去掉 query / hash。
  let s = url.split('#')[0] ?? ''
  s = s.split('?')[0] ?? ''
  // 取最后一段路径。
  const lastSlash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  let seg = lastSlash >= 0 ? s.slice(lastSlash + 1) : s
  // 尽力 URL decode（可能含 %2E 等）。
  try {
    seg = decodeURIComponent(seg)
  } catch {
    /* 含非法 % 序列时保持原样 */
  }
  const dot = seg.lastIndexOf('.')
  if (dot < 0 || dot === seg.length - 1) return ''
  return seg.slice(dot).toLowerCase()
}

/**
 * 是否为文档类附件（doc/docx/ppt/pptx/xls/xlsx/pdf）。
 * Win 拖入文件 `f.type` 常为空 → 优先按 `f.name` 扩展名判定。
 */
export function isDocFile(f: File): boolean {
  return DOC_SET.has(extOf(f.name))
}

/**
 * 是否为图片文件。优先扩展名，其次 `f.type`（`image/*`）兜底。
 */
export function isImageFile(f: File): boolean {
  if (IMAGE_SET.has(extOf(f.name))) return true
  return typeof f.type === 'string' && f.type.startsWith('image/')
}

const WORD_INFO: FileKindInfo = {
  kind: 'word',
  // Word 品牌蓝（非 cat-kaggle 的墨绿松石）；图标用任意值精确取色，底座用同色 10% tint。
  label: 'Word',
  iconColorClass: 'text-[#2b579a]',
  tileBgClass: 'bg-[#2b579a]/10',
}
const EXCEL_INFO: FileKindInfo = {
  kind: 'excel',
  label: 'Excel',
  iconColorClass: 'text-cat-tools',
  tileBgClass: 'bg-tag-tools',
}
const PPT_INFO: FileKindInfo = {
  kind: 'ppt',
  label: 'PPT',
  iconColorClass: 'text-cat-course',
  tileBgClass: 'bg-tag-course',
}
const PDF_INFO: FileKindInfo = {
  kind: 'pdf',
  label: 'PDF',
  iconColorClass: 'text-cat-research',
  tileBgClass: 'bg-tag-research',
}
const IMAGE_INFO: FileKindInfo = {
  kind: 'image',
  label: '图片',
  iconColorClass: 'text-cat-recommend',
  tileBgClass: 'bg-tag-recommend',
}
const CODE_INFO: FileKindInfo = {
  kind: 'code',
  label: '代码',
  iconColorClass: 'text-cat-competition',
  tileBgClass: 'bg-tag-competition',
}
const ARCHIVE_INFO: FileKindInfo = {
  kind: 'archive',
  label: '压缩包',
  iconColorClass: 'text-cat-life',
  tileBgClass: 'bg-tag-life',
}
const OTHER_INFO: FileKindInfo = {
  kind: 'other',
  label: '文件',
  iconColorClass: 'text-text-muted',
  tileBgClass: 'bg-bg-subtle',
}

/**
 * 把扩展名归一到 kind + 视觉 token。入参可带或不带前导点、大小写不敏感。
 * 未知扩展名 → `other`（灰底，外层走 lucide `File`）。
 */
export function kindOf(ext: string): FileKindInfo {
  const e = normalizeExt(ext)
  if (WORD_SET.has(e)) return WORD_INFO
  if (EXCEL_SET.has(e)) return EXCEL_INFO
  if (PPT_SET.has(e)) return PPT_INFO
  if (PDF_SET.has(e)) return PDF_INFO
  if (IMAGE_SET.has(e)) return IMAGE_INFO
  if (CODE_SET.has(e)) return CODE_INFO
  if (ARCHIVE_SET.has(e)) return ARCHIVE_INFO
  return OTHER_INFO
}

/**
 * 决定共享 viewer 的分发目标。
 * - `.pdf` → pdfjs-dist
 * - `.docx` → docx-preview（旧版 `.doc` 不支持在线预览 → unsupported）
 * - `.xlsx` → @js-preview/excel（旧版 `.xls` 同理 unsupported）
 * - 图片 → 原生 <img>
 * - 代码/文本 → highlight.js
 * - 其余（.ppt/.pptx/.doc/.xls/压缩包/...）→ unsupported（降级下载卡）
 */
export function previewKind(ext: string): PreviewKind {
  const e = normalizeExt(ext)
  if (e === '.pdf') return 'pdf'
  if (e === '.docx') return 'docx'
  if (e === '.xlsx') return 'xlsx'
  if (IMAGE_SET.has(e)) return 'image'
  if (CODE_SET.has(e)) return 'code'
  return 'unsupported'
}

/** 该 previewKind 是否能在线预览（即非 `unsupported`）。 */
export function isPreviewable(kind: PreviewKind): boolean {
  return kind !== 'unsupported'
}

/**
 * 该 href 是否指向上传的文档附件 —— 由 Markdown `components.a` 用于区分
 * 「附件链接」(渲染 FileCard) 与「普通链接」(渲染 <a>)。
 * 命中条件：
 *   1. 末段扩展名 ∈ DOC_EXTS（大小写不敏感、容忍 ?query/#hash/URL编码）；且
 *   2. 路径走 `/uploads/`（相对，dev 同源）或绝对 `public_base_url` 下的
 *      `/uploads/` 路径段（prod 回源同源时也是相对，但跨源时是绝对 URL）。
 */
export function isAttachmentHref(href: string): boolean {
  if (!href) return false
  if (!DOC_SET.has(extOf(href))) return false

  // 取得 pathname：绝对 URL 解析，相对路径直接取 query 前的部分。
  let pathname: string
  if (/^https?:\/\//i.test(href)) {
    try {
      pathname = new URL(href).pathname
    } catch {
      return false
    }
  } else {
    pathname = (href.split('#')[0] ?? '').split('?')[0] ?? ''
  }
  try {
    pathname = decodeURIComponent(pathname)
  } catch {
    /* keep raw */
  }
  return pathname.includes('/uploads/')
}

/**
 * 人类可读字节数（1024 进制，最多 1 位小数）。
 * `formatBytes(0)` → '0 B'；`formatBytes(1536)` → '1.5 KB'。
 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  const rounded = Math.round(value * 10) / 10
  // 整数不显示 `.0`。
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text} ${units[i]}`
}

/** 归一化扩展名：补前导点、去空白、转小写。 */
function normalizeExt(ext: string): string {
  if (!ext) return ''
  let e = ext.trim().toLowerCase()
  if (e && !e.startsWith('.')) e = `.${e}`
  return e
}
