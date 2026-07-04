import { describe, expect, it } from 'vitest'

import { committeeTone } from './committee'

describe('committeeTone', () => {
  it('班长 / 团支书 → red', () => {
    expect(committeeTone('班长')).toBe('red')
    expect(committeeTone('团支书')).toBe('red')
    expect(committeeTone(' 班长 ')).toBe('red') // 容忍首尾空白
  })

  it('其他职务 → orange', () => {
    for (const t of ['学习委员', '体育委员', '文艺委员', '生活委员', '心理委员', '自定义职务']) {
      expect(committeeTone(t)).toBe('orange')
    }
  })

  it('空 / 未设置（通用班委）→ orange', () => {
    expect(committeeTone(null)).toBe('orange')
    expect(committeeTone(undefined)).toBe('orange')
    expect(committeeTone('')).toBe('orange')
  })
})
