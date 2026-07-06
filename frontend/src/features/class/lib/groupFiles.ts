import type { GroupFile } from '@/api/schemas/class'

/**
 * 组内文件的筛选 / 排序 / 分组纯函数 —— 面板 UI（列表工具条 + 卡片手风琴）
 * 共用。全部无副作用、稳定排序，便于单测与两种视图对齐。
 */

export type SortKey = 'newest' | 'oldest' | 'name' | 'size'

export const SORT_LABELS: Record<SortKey, string> = {
  newest: '最新上传',
  oldest: '最早上传',
  name: '名称 A→Z',
  size: '体积大→小',
}

/** 扩展名归一：小写、去掉前导点；空 → ''（无扩展名）。 */
export function normalizeExt(ext: string | null | undefined): string {
  return (ext ?? '').replace(/^\./, '').toLowerCase()
}

/** 扩展名的展示标签：有则大写，无则「无扩展名」。 */
export function extLabel(ext: string): string {
  return ext ? ext.toUpperCase() : '无扩展名'
}

export type Facet = { key: string; label: string; count: number }

/** 现有文件里出现的扩展名（按数量降序，无扩展名排最后）。 */
export function extFacets(files: GroupFile[]): Facet[] {
  const map = new Map<string, number>()
  for (const f of files) {
    const k = normalizeExt(f.ext)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: extLabel(key), count }))
    .sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : b.count - a.count))
}

/** 现有上传者（按数量降序）。key = sid，label = 昵称。 */
export function uploaderFacets(files: GroupFile[]): Facet[] {
  const map = new Map<string, { label: string; count: number }>()
  for (const f of files) {
    const cur = map.get(f.uploadedBySid)
    if (cur) cur.count += 1
    else map.set(f.uploadedBySid, { label: f.uploadedByNickname, count: 1 })
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count)
}

export type FileFilter = {
  /** 文件名子串（大小写不敏感）；空串不过滤。 */
  search: string
  /** 扩展名 key（normalizeExt 后）；'all' 不过滤。 */
  ext: string
  /** 上传者 sid；'all' 不过滤。 */
  uploader: string
}

export function filterFiles(files: GroupFile[], f: FileFilter): GroupFile[] {
  const q = f.search.trim().toLowerCase()
  return files.filter((file) => {
    if (q && !file.name.toLowerCase().includes(q)) return false
    if (f.ext !== 'all' && normalizeExt(file.ext) !== f.ext) return false
    if (f.uploader !== 'all' && file.uploadedBySid !== f.uploader) return false
    return true
  })
}

export function sortFiles(files: GroupFile[], key: SortKey): GroupFile[] {
  const out = [...files]
  switch (key) {
    case 'newest':
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'oldest':
      return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    case 'size':
      return out.sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))
  }
}

export type FileGroup = { key: string; label: string; count: number; files: GroupFile[] }

/** 按扩展名分组（组内按最新在前），组间 extFacets 的顺序。 */
export function groupByExt(files: GroupFile[]): FileGroup[] {
  return extFacets(files).map((facet) => ({
    ...facet,
    files: sortFiles(
      files.filter((f) => normalizeExt(f.ext) === facet.key),
      'newest',
    ),
  }))
}

/** 按上传者分组（组内按最新在前），组间 uploaderFacets 的顺序。 */
export function groupByUploader(files: GroupFile[]): FileGroup[] {
  return uploaderFacets(files).map((facet) => ({
    ...facet,
    files: sortFiles(
      files.filter((f) => f.uploadedBySid === facet.key),
      'newest',
    ),
  }))
}
