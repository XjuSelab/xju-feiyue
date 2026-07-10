import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Verification for the hidden /admin dashboard + 3-tier roles.
// Drives the real backend (:8000, migrated DB) with minted tokens injected
// into localStorage (no passwords needed). Exercises: normal user → 404,
// super-admin dashboard + promote flow, plain admin (no role buttons).
// Screenshots → playwright/screenshots/admin-*.png.

const API = 'http://localhost:8000'
const SHOTS = 'playwright/screenshots'
const tokens = JSON.parse(readFileSync('/tmp/admin_tokens.json', 'utf8')) as {
  super: string
  promotee: string
  user: string
}

const errors: string[] = []

/** Inject a minted token + persisted authed store, then land on /admin.
 *
 * Uses addInitScript (runs before app scripts on the next navigation) so the
 * store rehydrates from the right identity with no race against a prior page's
 * in-flight hydrateFromToken. Repeated calls add later-running scripts that
 * overwrite localStorage, so the most recent role wins. */
async function authAs(page: Page, token: string) {
  const me = await page.request.get(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(me.ok(), 'auth/me should succeed').toBeTruthy()
  const user = await me.json()
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem('labnotes.auth.token', token)
      localStorage.setItem(
        'labnotes.auth',
        JSON.stringify({ state: { user, token, mode: 'authed' }, version: 0 }),
      )
    },
    { user, token },
  )
  await page.goto('/admin')
  return user
}

test('admin dashboard: roles + promote flow', async ({ page }) => {
  test.setTimeout(120_000)
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

  // ---------- normal user → 404 (surface hidden) ----------
  await authAs(page, tokens.user)
  await expect(page.getByRole('heading', { name: /页面不存在/ })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: '管理后台' })).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/admin-01-user-404.png`, fullPage: true })

  // ---------- super-admin → dashboard ----------
  await authAs(page, tokens.super)
  await expect(page.getByRole('heading', { name: '管理后台' })).toBeVisible({ timeout: 10_000 })
  // Overview charts render (role distribution panel).
  await expect(page.getByText('角色分布')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('近 14 天登录活跃')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/admin-02-super-overview.png`, fullPage: true })

  // Users tab
  await page.getByRole('tab', { name: '用户' }).click()
  await expect(page.getByRole('button', { name: '导入用户' })).toBeVisible()
  const promoteeRow = page.locator('tr', { hasText: '20211019999' })
  await expect(promoteeRow).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/admin-03-super-users.png`, fullPage: true })

  // Promote 20211019999 → admin via row menu → confirm
  await promoteeRow.getByRole('button', { name: '用户操作' }).click()
  await page.getByRole('menuitem', { name: '设为管理员' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: '确定' }).click()
  // Row badge flips to 管理员 after refetch.
  await expect(promoteeRow.getByText('管理员', { exact: true })).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: `${SHOTS}/admin-04-super-promoted.png`, fullPage: true })

  // ---------- plain admin (20211019999, now admin) → no role buttons ----------
  const adminUser = await authAs(page, tokens.promotee)
  expect(adminUser.role).toBe('admin')
  expect(adminUser.isSuperAdmin).toBe(false)
  await expect(page.getByRole('heading', { name: '管理后台' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('tab', { name: '用户' }).click()
  // Open the normal user's (韩梅梅 / 20211010001) action menu.
  const userRow = page.locator('tr', { hasText: '20211010001' })
  await userRow.getByRole('button', { name: '用户操作' }).click()
  // A plain admin can reset a normal user but CANNOT change roles.
  await expect(page.getByRole('menuitem', { name: '重置密码' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /设为管理员|取消管理员/ })).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/admin-05-admin-no-rolebtns.png`, fullPage: true })
  await page.keyboard.press('Escape')

  if (errors.length) console.log('NON-FATAL ERRORS:\n' + errors.join('\n'))
  const fatal = errors.filter((e) => e.startsWith('[pageerror]'))
  expect(fatal, fatal.join('\n')).toHaveLength(0)
})
