/* Local IME composition verify harness for the /write CodeMirror editor.
 * Drives real Chromium via CDP Input.imeSetComposition + Input.insertText to
 * simulate Microsoft-Pinyin-style composition for every pinyin initial, plus
 * full-width punctuation, and reports which inputs the editor drops/mangles.
 *
 * This is the runnable-in-WSL twin of playwright/e2e/editor-ime.spec.ts (which
 * targets CI). Use it when `pnpm e2e` can't launch (browser build mismatch):
 * it auto-detects a cached Chromium and talks to whatever BASE you point it at.
 *
 *   BASE=http://localhost:5180 node scripts/ime-repro.cjs   # point at THIS project's dev server
 *
 * EditContext (the patched input path) needs Chromium 121+; the harness prints a
 * PROBE line confirming it's actually attached before running the matrix.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('@playwright/test')

const BASE = process.env.BASE || 'http://localhost:5173'

/** Newest cached Playwright Chromium (full build, not headless_shell). */
function findChromium() {
  if (process.env.CHROME) return process.env.CHROME
  const root = path.join(require('node:os').homedir(), '.cache/ms-playwright')
  const dirs = fs
    .readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const d of dirs) {
    const bin = path.join(root, d, 'chrome-linux64/chrome')
    if (fs.existsSync(bin)) return bin
  }
  throw new Error('no cached chromium-* found under ' + root)
}
const EXECUTABLE = findChromium()

// [label, lettersTyped, committedHan]
const PINYIN = [
  ['b', 'bei', '北'], ['p', 'peng', '朋'], ['m', 'ming', '明'], ['f', 'fang', '方'],
  ['d', 'dao', '到'], ['t', 'tian', '天'], ['n', 'ni', '你'], ['l', 'le', '了'],
  ['g', 'gao', '高'], ['k', 'kan', '看'], ['h', 'hao', '好'], ['j', 'jia', '家'],
  ['q', 'qian', '前'], ['x', 'xie', '写'], ['zh', 'zhong', '中'], ['ch', 'chang', '长'],
  ['sh', 'shi', '是'], ['r', 'ren', '人'], ['z', 'zai', '在'], ['c', 'cai', '才'],
  ['s', 'shuo', '说'], ['y', 'yong', '用'], ['w', 'wo', '我'],
  // reported pain points + neighbors
  ['k:ke', 'ke', '课'], ['k:kai', 'kai', '开'], ['r:ri', 'ri', '日'], ['r:ru', 'ru', '如'],
  ['r:ran', 'ran', '然'], ['d:de', 'de', '的'], ['j:jiu', 'jiu', '就'], ['s:suo', 'suo', '所'],
  ['g:ge', 'ge', '个'], ['f:fa', 'fa', '发'], ['x:xian', 'xian', '现'], ['z:zen', 'zen', '怎'],
]

// full-width punctuation: committed directly (Microsoft Pinyin inserts these without a candidate list)
const PUNCT = [['。', '。'], ['，', '，'], ['！', '！'], ['？', '？'], ['；', '；'], ['：', '：']]

async function compose(cdp, letters, commit) {
  for (let i = 1; i <= letters.length; i++) {
    await cdp.send('Input.imeSetComposition', {
      text: letters.slice(0, i),
      selectionStart: i,
      selectionEnd: i,
    })
  }
  await cdp.send('Input.insertText', { text: commit })
}

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE })
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem(
      'labnotes.auth',
      JSON.stringify({
        state: {
          user: { sid: '00000000000', name: 'Tester', nickname: '测试者', preferredName: '测试者', role: 'user', isAdmin: false, isSuperAdmin: false },
          token: null,
          mode: 'authed',
        },
        version: 0,
      }),
    )
  })
  const page = await context.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [page-error]', m.text())
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.enable').catch(() => {})

  await page.goto(`${BASE}/write`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.cm-content', { timeout: 15000 })
  await page.waitForTimeout(300)

  const probe = await page.evaluate(() => {
    const el = document.querySelector('.cm-content')
    return {
      hasEditContextAPI: typeof window.EditContext !== 'undefined',
      contentDomHasEditContext: !!(el && el.editContext),
      chromeVersion: (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1],
    }
  })
  console.log('PROBE', JSON.stringify(probe))

  async function clearEditor() {
    const el = await page.$('.cm-content')
    await el.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await page.waitForTimeout(15)
  }

  const results = []
  async function testHan(label, letters, expected) {
    await clearEditor()
    await compose(cdp, letters, expected)
    await page.waitForTimeout(40)
    const got = await page.evaluate(() => document.querySelector('.cm-content')?.textContent ?? '')
    const ok = got === expected
    results.push({ label, expected, got, ok })
    if (!ok) console.log(`  MISMATCH [${label}] typed="${letters}" want="${expected}" got="${JSON.stringify(got)}"`)
  }
  async function testPunct(label, expected) {
    await clearEditor()
    // direct commit (no candidate list)
    await cdp.send('Input.insertText', { text: expected })
    await page.waitForTimeout(40)
    const got = await page.evaluate(() => document.querySelector('.cm-content')?.textContent ?? '')
    const ok = got === expected
    results.push({ label: `punct ${label}`, expected, got, ok })
    if (!ok) console.log(`  MISMATCH [punct ${label}] want="${expected}" got="${JSON.stringify(got)}"`)
  }

  console.log('\n=== pinyin compositions ===')
  for (const [label, letters, han] of PINYIN) await testHan(label, letters, han)
  console.log('\n=== full-width punctuation (direct insert) ===')
  for (const [name, han] of PUNCT) await testPunct(name, han)

  const fails = results.filter((r) => !r.ok)
  console.log(`\n=== SUMMARY: ${results.length - fails.length}/${results.length} passed, ${fails.length} failed ===`)
  for (const f of fails) console.log(`  FAIL [${f.label}] want=${JSON.stringify(f.expected)} got=${JSON.stringify(f.got)}`)

  await browser.close()
  process.exit(fails.length ? 2 : 0)
}

run().catch((e) => {
  console.error('HARNESS ERROR', e)
  process.exit(1)
})
