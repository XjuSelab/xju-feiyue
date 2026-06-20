import { test, expect, type Page, type CDPSession } from '@playwright/test'

/**
 * End-to-end IME composition coverage for the /write markdown editor (CodeMirror 6
 * with the desktop-EditContext patch). Drives real Chromium via the CDP
 * `Input.imeSetComposition` / `Input.insertText` pipeline — the same path the OS
 * IME feeds — to simulate Microsoft-Pinyin-style input.
 *
 * Regression target: after enabling EditContext on desktop, an upstream CM6 bug
 * (broken `/[\\p{Alphabetic}\\p{Number}_]/` word-char regex) force-ended
 * composition on pure-deletion textupdates adjacent to k/d/g/j/n/q/s/x/z, digits
 * or CJK — i.e. "typing k/r-initial pinyin glitches / punctuation needs two
 * presses". The patch fixes the regex; these tests assert composition is faithful.
 *
 * No backend needed: /write only requires `mode:'authed'`; token:null skips the
 * boot() /auth/me call. Chromium project only (CDP IME is Chromium-specific).
 */

const USER = {
  sid: '00000000000',
  name: 'Tester',
  nickname: '测试者',
  preferredName: '测试者',
  role: 'user',
  isAdmin: false,
  isSuperAdmin: false,
}

async function gotoEditor(page: Page): Promise<CDPSession> {
  await page.addInitScript((user) => {
    localStorage.setItem(
      'labnotes.auth',
      JSON.stringify({ state: { user, token: null, mode: 'authed' }, version: 0 }),
    )
  }, USER)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.enable').catch(() => {})
  await page.goto('/write')
  await page.waitForSelector('.cm-content', { timeout: 15_000 })
  // Sanity: editor mounted AND EditContext is actually active (patch live).
  const ec = await page.evaluate(
    () => 'EditContext' in window && !!(document.querySelector('.cm-content') as unknown as { editContext?: unknown })?.editContext,
  )
  expect(ec, 'EditContext must be attached to the editor (desktop patch active)').toBe(true)
  await page.locator('.cm-content').click()
  return cdp
}

async function clear(page: Page) {
  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.waitForTimeout(15)
}

/** Compose `letters` one keystroke at a time, then commit `han`. */
async function compose(cdp: CDPSession, letters: string, commit: string) {
  for (let i = 1; i <= letters.length; i++) {
    await cdp.send('Input.imeSetComposition', {
      text: letters.slice(0, i),
      selectionStart: i,
      selectionEnd: i,
    })
  }
  await cdp.send('Input.insertText', { text: commit })
}

async function docText(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('.cm-content')?.textContent ?? '')
}

// [pinyin initial label, letters typed, committed han]
const PINYIN: Array<[string, string, string]> = [
  ['b', 'bei', '北'], ['p', 'peng', '朋'], ['m', 'ming', '明'], ['f', 'fang', '方'],
  ['d', 'dao', '到'], ['t', 'tian', '天'], ['n', 'ni', '你'], ['l', 'le', '了'],
  ['g', 'gao', '高'], ['k', 'kan', '看'], ['h', 'hao', '好'], ['j', 'jia', '家'],
  ['q', 'qian', '前'], ['x', 'xie', '写'], ['zh', 'zhong', '中'], ['ch', 'chang', '长'],
  ['sh', 'shi', '是'], ['r', 'ren', '人'], ['z', 'zai', '在'], ['c', 'cai', '才'],
  ['s', 'shuo', '说'], ['y', 'yong', '用'], ['w', 'wo', '我'],
  // reported pain points (k/r-initial)
  ['k:ke', 'ke', '课'], ['k:kai', 'kai', '开'], ['r:ri', 'ri', '日'],
  ['r:ru', 'ru', '如'], ['r:ran', 'ran', '然'],
]

const PUNCT = ['。', '，', '！', '？', '；', '：', '、']

test.describe('editor IME composition', () => {
  test('every pinyin initial commits the right han', async ({ page }) => {
    test.setTimeout(120_000)
    const cdp = await gotoEditor(page)
    for (const [label, letters, han] of PINYIN) {
      await clear(page)
      await compose(cdp, letters, han)
      await page.waitForTimeout(30)
      expect(await docText(page), `pinyin ${label} (${letters})`).toBe(han)
    }
  })

  test('full-width punctuation inserts in one shot (no double-press)', async ({ page }) => {
    const cdp = await gotoEditor(page)
    for (const p of PUNCT) {
      await clear(page)
      await cdp.send('Input.insertText', { text: p })
      await page.waitForTimeout(30)
      expect(await docText(page), `punctuation ${p}`).toBe(p)
    }
  })

  test('backspace-during-composition then commit (broken-regex trigger)', async ({ page }) => {
    const cdp = await gotoEditor(page)
    // k-class: type kan → backspace to ka → retype kan → commit 看
    await clear(page)
    for (const s of ['k', 'ka', 'kan', 'ka', 'k', 'ka', 'kan']) {
      await cdp.send('Input.imeSetComposition', { text: s, selectionStart: s.length, selectionEnd: s.length })
    }
    await cdp.send('Input.insertText', { text: '看' })
    await page.waitForTimeout(30)
    expect(await docText(page)).toBe('看')

    // r-class: ren → re → ren → commit 人
    await clear(page)
    for (const s of ['r', 're', 'ren', 're', 'ren']) {
      await cdp.send('Input.imeSetComposition', { text: s, selectionStart: s.length, selectionEnd: s.length })
    }
    await cdp.send('Input.insertText', { text: '人' })
    await page.waitForTimeout(30)
    expect(await docText(page)).toBe('人')
  })

  test('composing right after an existing CJK char (surrounding char = han)', async ({ page }) => {
    const cdp = await gotoEditor(page)
    await clear(page)
    await cdp.send('Input.insertText', { text: '看' })
    // now compose "kan" with backspace; the deletion textupdate sits next to 看 + k
    for (const s of ['k', 'ka', 'kan', 'ka', 'kan']) {
      await cdp.send('Input.imeSetComposition', { text: s, selectionStart: s.length, selectionEnd: s.length })
    }
    await cdp.send('Input.insertText', { text: '课' })
    await page.waitForTimeout(30)
    expect(await docText(page)).toBe('看课')
  })

  test('mixed latin + CJK + punctuation sentence, no page errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
    const cdp = await gotoEditor(page)
    await clear(page)
    // "用 CM6 写中文，很顺！"
    await compose(cdp, 'yong', '用')
    await page.keyboard.type(' CM6 ')
    await compose(cdp, 'xie', '写')
    await compose(cdp, 'zhong', '中')
    await compose(cdp, 'wen', '文')
    await cdp.send('Input.insertText', { text: '，' })
    await compose(cdp, 'hen', '很')
    await compose(cdp, 'shun', '顺')
    await cdp.send('Input.insertText', { text: '！' })
    await page.waitForTimeout(40)
    expect(await docText(page)).toBe('用 CM6 写中文，很顺！')
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})
