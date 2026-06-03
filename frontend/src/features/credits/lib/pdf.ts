/**
 * 在浏览器内用 pdf.js 提取成绩单 PDF 的文本项（不渲染、不上传）。
 * worker 配置复用 PdfViewer 的方案：Vite `?url` 打包本地 worker，零外网 CDN。
 */
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { RawTextItem } from '../types'

// worker 只需设一次（module 级）；若 PdfViewer 已设则不覆盖。
if (!GlobalWorkerOptions.workerSrc) GlobalWorkerOptions.workerSrc = workerUrl

/** 读取上传的 PDF，按页返回文本项（x/y 取自 transform 矩阵）。 */
export async function loadTextItems(file: File): Promise<RawTextItem[][]> {
  const data = await file.arrayBuffer()
  const doc = await getDocument({ data }).promise
  try {
    const pages: RawTextItem[][] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const tc = await page.getTextContent()
      const items: RawTextItem[] = []
      for (const it of tc.items) {
        if (!('str' in it)) continue // 跳过 TextMarkedContent
        const t = it.transform
        items.push({ str: it.str, x: t[4], y: t[5], w: it.width, h: it.height })
      }
      pages.push(items)
      page.cleanup()
    }
    return pages
  } finally {
    void doc.destroy()
  }
}
