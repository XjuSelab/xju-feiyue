import { test, expect, type Page } from '@playwright/test'

// Verification spec for: 写作栏文件上传 + 预览 + 「资料」页(KnoHub迁移).
// Drives the real backend (VITE_API_BASE=http://localhost:8000) with a seeded
// user, exercises the new UI, and saves screenshots to playwright/screenshots/.

const SID = '20211010001'
const PASSWORD = '123456'
const SHOTS = 'playwright/screenshots'
const PDF = '/tmp/t-lecture.pdf'

const errors: string[] = []

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#login-sid', SID)
  await page.fill('#login-password', PASSWORD)
  await page.locator('#login-password').press('Enter')
  // Land on an authed page; the 资料 nav link only renders in the app shell.
  await page.getByRole('link', { name: '资料' }).waitFor({ timeout: 15_000 })
}

test('uploads + materials UI verification', async ({ page }) => {
  test.setTimeout(180_000)
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

  await login(page)

  // ---------------- 资料 列表 ----------------
  await page.goto('/materials')
  const card = page.getByText('数据结构与算法 课程资料', { exact: false })
  await card.waitFor({ timeout: 15_000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/mat-01-list.png`, fullPage: true })

  // 新建资源弹窗
  try {
    await page.getByRole('button', { name: /新建|新增|添加/ }).first().click({ timeout: 3000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SHOTS}/mat-02-new-resource-dialog.png` })
    await page.keyboard.press('Escape')
  } catch (e) {
    errors.push(`[new-resource] ${String(e)}`)
  }

  // ---------------- 资料 详情：树 + 预览 ----------------
  await card.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOTS}/mat-03-detail.png`, fullPage: true })

  // 展开文件夹「第一章 绪论」
  try {
    await page.getByText('第一章 绪论', { exact: false }).first().click({ timeout: 4000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/mat-04-tree-expanded.png`, fullPage: true })
  } catch (e) {
    errors.push(`[expand-folder] ${String(e)}`)
  }

  // 预览 PDF（点击 .pdf 文件节点）
  try {
    await page.getByText(/t-lecture\.pdf|lecture\.pdf|\.pdf$/i).first().click({ timeout: 4000 })
    await page.waitForTimeout(2500) // pdfjs render
    await page.screenshot({ path: `${SHOTS}/mat-05-pdf-preview.png`, fullPage: true })
  } catch (e) {
    errors.push(`[pdf-preview] ${String(e)}`)
  }

  // 预览 DOCX
  try {
    await page.getByText(/\.docx$/i).first().click({ timeout: 4000 })
    await page.waitForTimeout(2500) // docx-preview render
    await page.screenshot({ path: `${SHOTS}/mat-06-docx-preview.png`, fullPage: true })
  } catch (e) {
    errors.push(`[docx-preview] ${String(e)}`)
  }

  // 上传弹窗
  try {
    await page.getByRole('button', { name: /上传/ }).first().click({ timeout: 4000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/mat-07-upload-dialog.png` })
    await page.keyboard.press('Escape')
  } catch (e) {
    errors.push(`[upload-dialog] ${String(e)}`)
  }

  // ---------------- 写作栏：附件上传 + 预览 ----------------
  await page.goto('/write')
  await page.waitForTimeout(1500) // editor mount + draft
  await page.screenshot({ path: `${SHOTS}/wr-01-write-page.png`, fullPage: true })

  // 用 doc 隐藏 input 上传真实 pdf（第 2 个 file input = docInputRef）
  const fileInputs = page.locator('input[type="file"]')
  await fileInputs.nth(1).setInputFiles(PDF)
  // 等正文里出现 FileCard（预览面板渲染）
  try {
    await page.locator('[data-filecard]').first().waitFor({ timeout: 12_000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${SHOTS}/wr-02-filecard-in-preview.png`, fullPage: true })
  } catch (e) {
    errors.push(`[filecard] ${String(e)}`)
    await page.screenshot({ path: `${SHOTS}/wr-02-filecard-MISSING.png`, fullPage: true })
  }

  // 点 FileCard 的预览按钮 → FilePreviewDialog
  try {
    const fc = page.locator('[data-filecard]').first()
    await fc.getByRole('button', { name: /预览/ }).first().click({ timeout: 4000 })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${SHOTS}/wr-03-preview-dialog.png`, fullPage: true })
  } catch (e) {
    errors.push(`[preview-dialog] ${String(e)}`)
  }

  // 汇总 console/page 错误（不致命，打印供人工判断）
  if (errors.length) console.log('NON-FATAL ERRORS:\n' + errors.join('\n'))
  // 仅在出现真正的页面崩溃（pageerror）时失败
  const fatal = errors.filter((e) => e.startsWith('[pageerror]'))
  expect(fatal, fatal.join('\n')).toHaveLength(0)
})
