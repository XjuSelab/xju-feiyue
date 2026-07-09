import { describe, it, expect } from 'vitest'
import {
  extOf,
  isDocFile,
  isImageFile,
  kindOf,
  previewKind,
  isPreviewable,
  isAttachmentHref,
  formatBytes,
} from './fileTypes'

/** Minimal File polyfill helper (jsdom File available, but keep explicit). */
function makeFile(name: string, type = ''): File {
  return new File(['x'], name, { type })
}

describe('extOf', () => {
  it('extracts lowercase extension with dot', () => {
    expect(extOf('foo.PDF')).toBe('.pdf')
    expect(extOf('a/b/c.DocX')).toBe('.docx')
  })

  it('strips query and hash', () => {
    expect(extOf('/uploads/notes/sid/x.pdf?v=2')).toBe('.pdf')
    expect(extOf('https://x.top/u/file.xlsx#page=3')).toBe('.xlsx')
  })

  it('handles URL-encoded segments', () => {
    expect(extOf('/uploads/%E8%AF%BE%E4%BB%B6.pptx')).toBe('.pptx')
  })

  it('returns empty string when no extension', () => {
    expect(extOf('/uploads/notes/sid/noext')).toBe('')
    expect(extOf('')).toBe('')
    expect(extOf('trailingdot.')).toBe('')
  })
})

describe('isDocFile / isImageFile', () => {
  it('detects doc by extension even when type is empty (Windows drop)', () => {
    expect(isDocFile(makeFile('报告.docx', ''))).toBe(true)
    expect(isDocFile(makeFile('sheet.xlsx'))).toBe(true)
    expect(isDocFile(makeFile('photo.png'))).toBe(false)
  })

  it('detects image by extension or mime fallback', () => {
    expect(isImageFile(makeFile('a.PNG', ''))).toBe(true)
    expect(isImageFile(makeFile('blob', 'image/webp'))).toBe(true)
    expect(isImageFile(makeFile('a.docx'))).toBe(false)
  })
})

describe('kindOf', () => {
  it('maps office families to brand colors', () => {
    // Word 用品牌蓝任意值（见 fileTypes.ts 注释），其余家族仍走 cat-* token。
    expect(kindOf('.docx')).toMatchObject({
      kind: 'word',
      iconColorClass: 'text-[#2b579a]',
      tileBgClass: 'bg-[#2b579a]/10',
    })
    expect(kindOf('xls')).toMatchObject({ kind: 'excel', iconColorClass: 'text-cat-tools' })
    expect(kindOf('.PPTX')).toMatchObject({ kind: 'ppt', iconColorClass: 'text-cat-course' })
    expect(kindOf('pdf')).toMatchObject({ kind: 'pdf', iconColorClass: 'text-cat-research' })
  })

  it('classifies image / code / archive / other', () => {
    expect(kindOf('.png').kind).toBe('image')
    expect(kindOf('.ts').kind).toBe('code')
    expect(kindOf('.zip').kind).toBe('archive')
    expect(kindOf('.unknownext').kind).toBe('other')
  })

  it('accepts ext with or without leading dot, case-insensitive', () => {
    expect(kindOf('DOCX').kind).toBe('word')
    expect(kindOf('.docx').kind).toBe('word')
  })
})

describe('previewKind / isPreviewable', () => {
  it('routes to the shared viewer kinds', () => {
    expect(previewKind('.pdf')).toBe('pdf')
    expect(previewKind('.docx')).toBe('docx')
    expect(previewKind('.xlsx')).toBe('xlsx')
    expect(previewKind('.png')).toBe('image')
    expect(previewKind('.py')).toBe('code')
  })

  it('legacy binaries + ppt fall back to unsupported', () => {
    expect(previewKind('.doc')).toBe('unsupported')
    expect(previewKind('.xls')).toBe('unsupported')
    expect(previewKind('.ppt')).toBe('unsupported')
    expect(previewKind('.pptx')).toBe('unsupported')
    expect(previewKind('.zip')).toBe('unsupported')
  })

  it('isPreviewable is false only for unsupported', () => {
    expect(isPreviewable('pdf')).toBe(true)
    expect(isPreviewable('unsupported')).toBe(false)
  })
})

describe('isAttachmentHref', () => {
  it('matches relative /uploads/ doc links', () => {
    expect(isAttachmentHref('/uploads/notes/sid/1700000000-ab12.pdf')).toBe(true)
    expect(isAttachmentHref('/uploads/materials/sid/rid/x.docx')).toBe(true)
  })

  it('matches absolute public_base_url doc links', () => {
    expect(isAttachmentHref('https://winbeau.top/uploads/notes/sid/x.xlsx')).toBe(true)
    expect(isAttachmentHref('http://localhost:8000/uploads/notes/sid/x.pptx')).toBe(true)
  })

  it('tolerates query string, hash, uppercase, URL-encoding', () => {
    expect(isAttachmentHref('/uploads/notes/sid/x.PDF?dl=1')).toBe(true)
    expect(isAttachmentHref('/uploads/notes/sid/x.docx#frag')).toBe(true)
    expect(
      isAttachmentHref('https://winbeau.top/uploads/%E8%AF%BE%E4%BB%B6.docx'),
    ).toBe(true)
  })

  it('rejects non-upload paths and non-doc extensions', () => {
    expect(isAttachmentHref('/uploads/notes/sid/photo.png')).toBe(false)
    expect(isAttachmentHref('https://example.com/page.docx')).toBe(false)
    expect(isAttachmentHref('/note/some-slug')).toBe(false)
    expect(isAttachmentHref('https://example.com')).toBe(false)
    expect(isAttachmentHref('')).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB')
  })

  it('returns empty for invalid input', () => {
    expect(formatBytes(-1)).toBe('')
    expect(formatBytes(NaN)).toBe('')
  })
})
