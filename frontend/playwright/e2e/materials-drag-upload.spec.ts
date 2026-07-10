import { test, expect, type Locator, type Page } from '@playwright/test'

// Verification spec for: 资料页左栏「拖文件进来即弹窗（预填待传清单）」.
// Drives the real backend (VITE_API_BASE=http://localhost:8000) with the seeded
// owner, drops a synthetic OS file onto the detail left pane, and asserts the
// UploadDialog opens pre-populated. Covers both the empty-card resource and a
// populated-tree resource. Screenshots → playwright/screenshots/.

const SID = '20211010001'
const PASSWORD = '123456'
const SHOTS = 'playwright/screenshots'

const errors: string[] = []

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#login-sid', SID)
  await page.fill('#login-password', PASSWORD)
  await page.locator('#login-password').press('Enter')
  await page.getByRole('link', { name: '资料' }).waitFor({ timeout: 15_000 })
}

/** Simulate an OS file drag-drop onto `target` (native HTML5, not dnd-kit). */
async function dragFileOnto(
  page: Page,
  target: Locator,
  name: string,
  body: string,
  type: string,
) {
  const dataTransfer = await page.evaluateHandle(
    ({ name, body, type }) => {
      const dt = new DataTransfer()
      dt.items.add(new File([body], name, { type }))
      return dt
    },
    { name, body, type },
  )
  // bubbles:true so the event reaches React's delegated root listener.
  const init = { dataTransfer, bubbles: true, cancelable: true }
  await target.dispatchEvent('dragenter', init)
  await target.dispatchEvent('dragover', init)
  return { dataTransfer, init }
}

async function openResource(page: Page, title: string) {
  await page.goto('/materials')
  const card = page.getByText(title, { exact: false }).first()
  await card.waitFor({ timeout: 15_000 })
  await card.click()
  // Detail view: left pane drop target present.
  await page.locator('[data-materials-pane]').waitFor({ timeout: 15_000 })
  await page.waitForTimeout(500)
}

test('资料详情左栏：拖文件进来即弹窗并预填', async ({ page }) => {
  test.setTimeout(120_000)
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

  await login(page)

  // ---------- 空白卡片（无文件的资源）：拖入 → overlay → 弹窗预填 ----------
  await openResource(page, '操作系统 课程资料')
  const pane = page.locator('[data-materials-pane]')
  const uploadDialog = page.getByRole('dialog').filter({ hasText: '上传文件' })

  // 拖入前：上传弹窗不在。
  await expect(uploadDialog).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/drag-01-empty-before.png`, fullPage: true })

  // dragenter/over → 整列高亮 overlay 出现。
  const { dataTransfer, init } = await dragFileOnto(
    page,
    pane,
    '操作系统笔记.txt',
    'hello materials drag upload',
    'text/plain',
  )
  await expect(page.getByText('松开以上传到此资料')).toBeVisible({ timeout: 5000 })
  await page.screenshot({ path: `${SHOTS}/drag-02-empty-overlay.png`, fullPage: true })

  // drop → UploadDialog 打开，待传清单已预填该文件（basename 进可编辑 Input）。
  await pane.dispatchEvent('drop', init)
  await expect(uploadDialog).toBeVisible({ timeout: 5000 })
  // 预填项：basename「操作系统笔记」落在重命名 Input，扩展名「.txt」只读后缀。
  await expect(uploadDialog.locator('input[aria-label="重命名 操作系统笔记.txt"]')).toHaveValue(
    '操作系统笔记',
  )
  await expect(uploadDialog.getByText('待上传')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/drag-03-empty-dialog-prefilled.png`, fullPage: true })

  await page.keyboard.press('Escape')
  await expect(uploadDialog).toHaveCount(0)
  void dataTransfer

  // ---------- 已有文件的资源：拖到树区同样弹窗预填 ----------
  await openResource(page, '软件工程 课程资料')
  const pane2 = page.locator('[data-materials-pane]')
  const drop2 = await dragFileOnto(
    page,
    pane2,
    'extra.pdf',
    '%PDF-1.4 fake',
    'application/pdf',
  )
  await expect(page.getByText('松开以上传到此资料')).toBeVisible({ timeout: 5000 })
  await pane2.dispatchEvent('drop', drop2.init)
  const dialog2 = page.getByRole('dialog').filter({ hasText: '上传文件' })
  await expect(dialog2).toBeVisible({ timeout: 5000 })
  await expect(dialog2.locator('input[aria-label="重命名 extra.pdf"]')).toHaveValue('extra')
  await page.screenshot({ path: `${SHOTS}/drag-04-populated-dialog-prefilled.png`, fullPage: true })

  if (errors.length) console.log('NON-FATAL ERRORS:\n' + errors.join('\n'))
  const fatal = errors.filter((e) => e.startsWith('[pageerror]'))
  expect(fatal, fatal.join('\n')).toHaveLength(0)
})
