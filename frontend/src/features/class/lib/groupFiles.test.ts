import { describe, expect, it } from 'vitest'

import type { GroupFile } from '@/api/schemas/class'

import {
  extFacets,
  filterFiles,
  groupByExt,
  groupByUploader,
  normalizeExt,
  sortFiles,
  uploaderFacets,
} from './groupFiles'

function mk(over: Partial<GroupFile> & Pick<GroupFile, 'id'>): GroupFile {
  return {
    name: `${over.id}.txt`,
    ext: 'txt',
    mime: null,
    size: '1 KB',
    sizeBytes: 1024,
    url: null,
    uploadedBySid: 's1',
    uploadedByNickname: '张三',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

const files: GroupFile[] = [
  mk({ id: 'a', name: '需求文档.pdf', ext: 'pdf', sizeBytes: 300, uploadedBySid: 's1', uploadedByNickname: '张三', createdAt: '2026-01-03T00:00:00Z' }),
  mk({ id: 'b', name: '设计图.png', ext: 'PNG', sizeBytes: 900, uploadedBySid: 's2', uploadedByNickname: '李四', createdAt: '2026-01-01T00:00:00Z' }),
  mk({ id: 'c', name: '报告.pdf', ext: '.pdf', sizeBytes: 100, uploadedBySid: 's1', uploadedByNickname: '张三', createdAt: '2026-01-02T00:00:00Z' }),
  mk({ id: 'd', name: 'README', ext: null, sizeBytes: 50, uploadedBySid: 's2', uploadedByNickname: '李四', createdAt: '2026-01-04T00:00:00Z' }),
]

describe('normalizeExt', () => {
  it('lowercases and strips leading dot; empty for missing', () => {
    expect(normalizeExt('.PDF')).toBe('pdf')
    expect(normalizeExt('PNG')).toBe('png')
    expect(normalizeExt(null)).toBe('')
  })
})

describe('facets', () => {
  it('extFacets merges case/dot variants, no-ext sorts last', () => {
    const f = extFacets(files)
    expect(f.map((x) => x.key)).toEqual(['pdf', 'png', ''])
    expect(f.find((x) => x.key === 'pdf')?.count).toBe(2)
    expect(f.at(-1)?.label).toBe('无扩展名')
  })
  it('uploaderFacets counts per sid', () => {
    const u = uploaderFacets(files)
    expect(u.map((x) => [x.key, x.count])).toEqual([
      ['s1', 2],
      ['s2', 2],
    ])
  })
})

describe('filterFiles', () => {
  it('filters by search (case-insensitive), ext, uploader', () => {
    expect(filterFiles(files, { search: 'pdf', ext: 'all', uploader: 'all' }).map((f) => f.id)).toEqual(['a', 'c'])
    expect(filterFiles(files, { search: '', ext: 'pdf', uploader: 'all' }).map((f) => f.id)).toEqual(['a', 'c'])
    expect(filterFiles(files, { search: '', ext: '', uploader: 'all' }).map((f) => f.id)).toEqual(['d'])
    expect(filterFiles(files, { search: '', ext: 'all', uploader: 's2' }).map((f) => f.id)).toEqual(['b', 'd'])
  })
})

describe('sortFiles', () => {
  it('newest / oldest by createdAt, size desc', () => {
    expect(sortFiles(files, 'newest').map((f) => f.id)).toEqual(['d', 'a', 'c', 'b'])
    expect(sortFiles(files, 'oldest').map((f) => f.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(sortFiles(files, 'size').map((f) => f.id)).toEqual(['b', 'a', 'c', 'd'])
  })
  it('does not mutate input', () => {
    const before = files.map((f) => f.id)
    sortFiles(files, 'size')
    expect(files.map((f) => f.id)).toEqual(before)
  })
})

describe('grouping', () => {
  it('groupByExt groups + orders files newest-first', () => {
    const g = groupByExt(files)
    expect(g.map((x) => x.key)).toEqual(['pdf', 'png', ''])
    expect(g[0]?.files.map((f) => f.id)).toEqual(['a', 'c'])
  })
  it('groupByUploader groups by sid', () => {
    const g = groupByUploader(files)
    expect(g.map((x) => x.key)).toEqual(['s1', 's2'])
    expect(g[1]?.files.map((f) => f.id)).toEqual(['d', 'b'])
  })
})
