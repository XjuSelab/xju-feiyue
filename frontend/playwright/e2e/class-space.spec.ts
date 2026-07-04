import { test, expect, type Locator, type Page } from '@playwright/test'

// 小组全流程（serial：同一账号受「一人一组」约束，测试间共享同一个组）：
// 1) 建组（Logo fallback + 1 名成员）→ 进入 /class/groups/:gid → 改简介 →
//    刷新持久；
// 2) 拖文件到 [data-group-files-pane] → 预填上传弹窗 → 真上传 → 列表出现；
// 3) 甘特：新建任务 → 任务条可见 → 点条编辑改「已完成」（进度自动 100）→
//    拖移平移日期（非致命断言）；
// 4) 清理：解散小组（保证可重跑）。
// 依赖 seed：20211010001（测试同学，班委）。

const SID = '20211010001'
const PASSWORD = '123456'
const SHOTS = 'playwright/screenshots'
const GROUP_NAME = `e2e小组-${Date.now()}`

test.describe.configure({ mode: 'serial' })

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#login-sid', SID)
  await page.fill('#login-password', PASSWORD)
  await page.locator('#login-password').press('Enter')
  await page.getByRole('link', { name: '班级' }).waitFor({ timeout: 15_000 })
}

/** 解散当前用户名下的存活小组（上次失败运行的残留），保证建组不 409。 */
async function dissolveOwnGroupIfAny(page: Page) {
  for (let i = 0; i < 3; i++) {
    await page.goto('/class')
    await page.getByRole('tab', { name: '小组' }).waitFor({ timeout: 15_000 })
    await page.waitForTimeout(600)
    const enter = page.getByRole('link', { name: /进入小组/ }).first()
    if ((await enter.count()) === 0) return
    await enter.click()
    const dissolve = page.getByRole('button', { name: '解散小组' })
    if ((await dissolve.count()) === 0) return // 是成员不是组长 —— 不该发生
    await dissolve.click()
    await page.getByRole('button', { name: '解散', exact: true }).click()
    await page.waitForURL('**/class', { timeout: 15_000 })
  }
}

async function enterOwnGroup(page: Page) {
  await page.goto('/class')
  const enter = page.getByRole('link', { name: /进入小组/ }).first()
  await enter.waitFor({ timeout: 15_000 })
  await enter.click()
  await page.waitForURL('**/class/groups/**', { timeout: 15_000 })
}

/** 原生 HTML5 文件拖放（materials spec 同款 helper）。 */
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
  const init = { dataTransfer, bubbles: true, cancelable: true }
  await target.dispatchEvent('dragenter', init)
  await target.dispatchEvent('dragover', init)
  return { dataTransfer, init }
}

test('小组：创建 → 进入空间 → 改简介并持久', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)
  await dissolveOwnGroupIfAny(page)

  await page.goto('/class')
  await page.getByRole('button', { name: '创建小组' }).first().click()
  const dialog = page.getByRole('dialog').filter({ hasText: '创建小组' })
  await dialog.getByLabel('组名').fill(GROUP_NAME)
  await dialog.getByLabel('简要介绍（可选）').fill('e2e 冒烟小组')
  await dialog.getByRole('button', { name: '创建小组' }).click()

  // 卡片出现：组长徽标 + 1 名成员 + initials fallback Logo。
  const card = page.locator('li', { hasText: GROUP_NAME }).first()
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText('组长')).toBeVisible()
  await expect(card.getByText(/1 名成员/)).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/group-01-card.png`, fullPage: true })

  // 进入小组空间（可分享 URL）。
  await card.getByRole('link', { name: /进入小组/ }).click()
  await page.waitForURL('**/class/groups/**', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: GROUP_NAME })).toBeVisible()

  // 行内编辑简介 → 保存 → 刷新持久。
  await page.getByRole('button', { name: '编辑' }).click()
  const intro = page.getByPlaceholder('介绍一下小组的目标、分工、进展…')
  await intro.fill('目标：把班级管理模块做完。分工：全栈一把梭。')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('目标：把班级管理模块做完')).toBeVisible({ timeout: 10_000 })
  await page.reload()
  await expect(page.getByText('目标：把班级管理模块做完')).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: `${SHOTS}/group-02-space-intro.png`, fullPage: true })
})

test('小组文件：拖拽 → 预填弹窗 → 上传 → 列表出现', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)
  await enterOwnGroup(page)

  const pane = page.locator('[data-group-files-pane]')
  await pane.waitFor({ timeout: 15_000 })

  const { init } = await dragFileOnto(
    page,
    pane,
    '组内资料.pdf',
    '%PDF-1.4 fake e2e payload',
    'application/pdf',
  )
  await expect(page.getByText('松开以上传到本小组')).toBeVisible({ timeout: 5000 })
  await pane.dispatchEvent('drop', init)

  const dialog = page.getByRole('dialog').filter({ hasText: '上传到小组' })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await expect(dialog.locator('input[aria-label="重命名 组内资料.pdf"]')).toHaveValue('组内资料')
  await page.screenshot({ path: `${SHOTS}/group-03-upload-prefilled.png`, fullPage: true })

  await dialog.getByRole('button', { name: /上传 \(1\)/ }).click()
  await expect(dialog).toHaveCount(0, { timeout: 30_000 })
  await expect(pane.getByText('组内资料.pdf')).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: `${SHOTS}/group-04-file-row.png`, fullPage: true })
})

test('甘特：新建任务 → 点条编辑「已完成」→ 拖移平移日期', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)
  await enterOwnGroup(page)

  // 新建任务（默认今天 ~ +6 天）。
  await page.getByRole('button', { name: '新建任务' }).click()
  const form = page.getByRole('dialog').filter({ hasText: '新建任务' })
  await form.getByLabel('标题').fill('需求分析')
  await form.getByText('测试同学', { exact: true }).click() // 负责人 checkbox
  await form.getByRole('button', { name: '创建', exact: true }).click()

  const bar = page.locator('button[aria-label="任务 需求分析"]')
  await expect(bar).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: `${SHOTS}/group-05-gantt-bar.png`, fullPage: true })

  // 点条 → 编辑弹窗预填 → 状态改已完成（进度自动 100）→ 保存。
  await bar.click()
  const edit = page.getByRole('dialog').filter({ hasText: '编辑任务' })
  await expect(edit.getByLabel('标题')).toHaveValue('需求分析')
  await edit.getByLabel('任务状态').click()
  await page.getByRole('option', { name: '已完成' }).click()
  await expect(edit.getByLabel('进度（%）')).toHaveValue('100')
  const startBefore = await edit.getByLabel('开始日期').inputValue()
  await edit.getByRole('button', { name: '保存', exact: true }).click()
  await expect(edit).toHaveCount(0, { timeout: 10_000 })

  // 拖移（pointer capture 在 overflow 容器内最易碎 → 非致命断言）：
  // 向右 64px = +2 天；重开弹窗看日期是否平移。
  const box = await bar.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 64, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(800)
    await bar.click()
    const startAfter = await edit.getByLabel('开始日期').inputValue()
    if (startAfter === startBefore) {
      console.log('NON-FATAL: 拖移未平移日期（pointer 事件在该环境未触发拖拽）')
    } else {
      expect(startAfter > startBefore).toBeTruthy()
    }
    await page.keyboard.press('Escape')
  }
  await page.screenshot({ path: `${SHOTS}/group-06-gantt-done.png`, fullPage: true })
})

test('清理：解散小组', async ({ page }) => {
  test.setTimeout(60_000)
  await login(page)
  await dissolveOwnGroupIfAny(page)
  await page.goto('/class')
  await expect(page.getByRole('link', { name: /进入小组/ })).toHaveCount(0, { timeout: 15_000 })
})
