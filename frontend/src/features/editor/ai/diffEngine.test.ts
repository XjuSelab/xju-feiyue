import { describe, it, expect } from 'vitest'
import { computeDiff, applyAccept, applyReject } from './diffEngine'

describe('computeDiff', () => {
  it('returns single equal segment when texts match', () => {
    const segs = computeDiff('hello', 'hello')
    expect(segs).toEqual([{ type: 'equal', text: 'hello' }])
  })

  it('produces add+del segments for an insertion', () => {
    const segs = computeDiff('hello world', 'hello big world')
    const types = segs.map((s) => s.type)
    expect(types).toContain('add')
    // Reconstruct after by dropping del segments
    const after = segs
      .filter((s) => s.type !== 'del')
      .map((s) => s.text)
      .join('')
    expect(after).toBe('hello big world')
  })

  it('handles deletion-only edits', () => {
    const segs = computeDiff('hello big world', 'hello world')
    expect(segs.some((s) => s.type === 'del')).toBe(true)
  })

  it('preserves Chinese characters at character granularity', () => {
    const segs = computeDiff('我觉得很好', '笔者认为很好')
    // After applying add segments: 笔者认为很好
    expect(applyAccept(segs)).toBe('笔者认为很好')
    expect(applyReject(segs)).toBe('我觉得很好')
  })

  it('handles mixed CN/EN text', () => {
    const segs = computeDiff('使用 numpy 计算', '使用 numpy 和 pandas 计算')
    expect(applyAccept(segs)).toBe('使用 numpy 和 pandas 计算')
    expect(applyReject(segs)).toBe('使用 numpy 计算')
  })

  it('total text equals before/after when partitioned by type', () => {
    const before = 'The quick brown fox'
    const after = 'The slow brown fox'
    const segs = computeDiff(before, after)
    expect(applyReject(segs)).toBe(before)
    expect(applyAccept(segs)).toBe(after)
  })
})
