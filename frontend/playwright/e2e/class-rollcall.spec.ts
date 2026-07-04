import { test, expect, type Page } from '@playwright/test'

// 班级点名全流程：发起 → 勾选一人（乐观计数）→ 完成点名 → 历史行出勤统计
// → 展开缺勤名单高亮 → 删除（清理，保持可重跑）。
// 依赖 seed：20211010001（测试同学）是 计算机科学与技术24-3 的班委，
// 同班还有 winbeau/张演示/李演示（scripts/seed.py）。

const SID = '20211010001'
const PASSWORD = '123456'
const SHOTS = 'playwright/screenshots'

const errors: string[] = []

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#login-sid', SID)
  await page.fill('#login-password', PASSWORD)
  await page.locator('#login-password').press('Enter')
  await page.getByRole('link', { name: '班级' }).waitFor({ timeout: 15_000 })
}

test('点名：发起 → 勾选 → 完成 → 历史缺勤展示 → 删除', async ({ page }) => {
  test.setTimeout(120_000)
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

  await login(page)
  await page.goto('/class?tab=rollcall')
  await page.getByRole('button', { name: '发起点名' }).waitFor({ timeout: 15_000 })
  await page.screenshot({ path: `${SHOTS}/rollcall-01-tab.png`, fullPage: true })

  // 发起 → 进入勾选视图，全员未到。
  await page.getByRole('button', { name: '发起点名' }).click()
  const count = page.getByTestId('rollcall-count')
  await expect(count).toBeVisible({ timeout: 15_000 })
  await expect(count).toHaveText(/出勤 0\/\d+/)
  const totalText = await count.textContent()
  const total = Number(totalText?.match(/\/(\d+)/)?.[1] ?? '0')
  expect(total).toBeGreaterThanOrEqual(2)

  // 勾选一人 —— 乐观计数即时 +1。
  await page.getByLabel('张演示 到点').click()
  await expect(count).toHaveText(new RegExp(`出勤 1/${total}`))
  await page.screenshot({ path: `${SHOTS}/rollcall-02-checked.png`, fullPage: true })

  // 完成点名 → 回到历史列表，最新一行显示 出勤 1/N。
  await page.getByRole('button', { name: '完成点名' }).click()
  await page.getByRole('button', { name: '发起点名' }).waitFor({ timeout: 15_000 })
  const firstRow = page.locator('li', { hasText: '出勤' }).first()
  await expect(firstRow).toContainText(`出勤 1/${total}`)

  // 展开 → 缺勤摘要 + 缺勤名单高亮（张演示已到，其余为缺）。
  await firstRow.locator('button[aria-expanded]').click()
  await expect(firstRow.getByText(/^缺勤：/)).toBeVisible({ timeout: 10_000 })
  await expect(firstRow.getByText('张演示 到', { exact: false })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/rollcall-03-history-expanded.png`, fullPage: true })

  // 清理：删除本次点名（保证 spec 可重复跑，不污染历史）。
  await firstRow.getByRole('button', { name: '删除本次点名' }).click()
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByText(`出勤 1/${total}`)).toHaveCount(0, { timeout: 10_000 })

  if (errors.length) console.log('NON-FATAL ERRORS:\n' + errors.join('\n'))
  const fatal = errors.filter((e) => e.startsWith('[pageerror]'))
  expect(fatal, fatal.join('\n')).toHaveLength(0)
})
