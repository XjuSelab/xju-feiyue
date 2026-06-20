import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Guards the two-part `@codemirror/view` patch that makes Chinese IME input work
 * in the markdown editor (see patches/@codemirror__view.patch):
 *
 *  1. Enable the EditContext API on DESKTOP Chromium (upstream only enables it on
 *     Android). EditContext bypasses the buggy contenteditable composition path
 *     where full-width punctuation (。，！？) needed two presses.
 *
 *  2. Fix a genuine upstream bug on that same EditContext path: the "missed
 *     compositionend" workaround ships a broken regex
 *         /[\\p{Alphabetic}\\p{Number}_]/      (doubled backslash, NO u flag)
 *     which matches a literal character set instead of Unicode word chars. That
 *     made composition force-end on pure-deletion textupdates whenever the
 *     adjacent char was e.g. k/d/g/j/n/q/s/x/z, any digit, or any CJK char —
 *     i.e. "typing k/r-initial pinyin glitches / needs two presses". Correct
 *     intent is /[\p{Alphabetic}\p{Number}_]/u.
 *
 * Because the bug lives in node_modules (and re-appears on every fresh install
 * if the patch silently stops applying), these tests read the installed dist
 * directly. If they fail, run `pnpm install` and check pnpm-workspace.yaml +
 * patches/@codemirror__view.patch.
 */

/** Walk up from cwd to find node_modules/@codemirror/view/dist/index.js. */
function resolveViewDist(): string {
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'node_modules/@codemirror/view/dist/index.js')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('could not locate @codemirror/view dist from ' + process.cwd())
}
const dist = readFileSync(resolveViewDist(), 'utf8')

describe('@codemirror/view patch integrity (installed dist)', () => {
  it('enables EditContext on desktop Chromium (android gate removed)', () => {
    // patched form: no `browser.android &&`
    expect(dist).toContain('if (window.EditContext && view.constructor.EDIT_CONTEXT !== false &&')
    // original android-only gate must be gone
    expect(dist).not.toContain(
      'if (window.EditContext && browser.android && view.constructor.EDIT_CONTEXT !== false &&',
    )
  })

  it('uses the corrected Unicode word-char regex (single backslash + u flag)', () => {
    expect(dist).toContain('/[\\p{Alphabetic}\\p{Number}_]/u.test(')
  })

  it('no longer contains the broken doubled-backslash regex', () => {
    // doubled backslash, no u flag — the upstream bug
    expect(dist).not.toContain('/[\\\\p{Alphabetic}\\\\p{Number}_]/.test(')
  })

  it('carries both Aurash patch markers', () => {
    const markers = dist.match(/PATCH \(Aurash\)/g) ?? []
    expect(markers.length).toBe(2)
  })
})

/**
 * Behavioral contract of the word-char test used by CM6's compositionend
 * workaround. We reconstruct both the broken (as-shipped upstream) and the
 * fixed regex and assert exactly which characters each treats as a "word char".
 * This both documents the root cause and locks the fix.
 */
// Fixed regex = what the patch installs.
const FIXED = /[\p{Alphabetic}\p{Number}_]/u
// Broken regex = what upstream 6.42.x–6.43.x ship (doubled backslash, no u flag).
// Built via RegExp so the source bytes match the dist exactly: [\\p{Alphabetic}\\p{Number}_]
const BROKEN = new RegExp(String.raw`[\\p{Alphabetic}\\p{Number}_]`)

const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('')
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const DIGITS = '0123456789'.split('')
// representative han incl. the reported pain points (k-/r-initial) and common chars
const HAN = '看课开口人日如然中文你好我们的是在说用写家前到'.split('')
const FULLWIDTH_PUNCT = '。，！？；：、""‘’（）《》'.split('')
const ASCII_NON_WORD = ['.', ',', '!', '?', ' ', '-', '/', '\n', '\t']

describe('fixed regex — correct Unicode word-char classification', () => {
  it.each(LOWER)('lowercase latin %s → word', (c) => expect(FIXED.test(c)).toBe(true))
  it.each(UPPER)('uppercase latin %s → word', (c) => expect(FIXED.test(c)).toBe(true))
  it.each(DIGITS)('digit %s → word', (c) => expect(FIXED.test(c)).toBe(true))
  it('underscore → word', () => expect(FIXED.test('_')).toBe(true))
  it.each(HAN)('CJK %s → word', (c) => expect(FIXED.test(c)).toBe(true))
  it.each(FULLWIDTH_PUNCT)('full-width punctuation %s → NOT word', (c) =>
    expect(FIXED.test(c)).toBe(false),
  )
  it.each(ASCII_NON_WORD)('ascii separator %j → NOT word', (c) =>
    expect(FIXED.test(c)).toBe(false),
  )
})

describe('broken upstream regex — documents why k/d/g/j/n/q/s/x/z & CJK glitched', () => {
  // Letters the broken literal set happens to contain (coincidentally OK).
  const OK_BY_ACCIDENT = 'abcehilmprtu'.split('')
  // Letters the broken set MISSES → wrongly treated as non-word → composition force-end.
  const MISCLASSIFIED = 'dfgjknoqsvwxyz'.split('')

  it.each(OK_BY_ACCIDENT)('broken regex coincidentally matches %s', (c) =>
    expect(BROKEN.test(c)).toBe(true),
  )
  it.each(MISCLASSIFIED)('broken regex WRONGLY rejects word char %s', (c) => {
    expect(BROKEN.test(c)).toBe(false) // the bug
    expect(FIXED.test(c)).toBe(true) // the fix
  })
  it.each(DIGITS)('broken regex WRONGLY rejects digit %s (fixed accepts)', (c) => {
    expect(BROKEN.test(c)).toBe(false)
    expect(FIXED.test(c)).toBe(true)
  })
  it.each(HAN)('broken regex WRONGLY rejects CJK %s (fixed accepts)', (c) => {
    expect(BROKEN.test(c)).toBe(false)
    expect(FIXED.test(c)).toBe(true)
  })
  it('the exact reported initials k and r: fixed treats both as word chars', () => {
    expect(FIXED.test('k')).toBe(true)
    expect(FIXED.test('r')).toBe(true)
  })
})
