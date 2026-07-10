import { describe, it, expect, beforeEach } from 'vitest'
import {
  familiarName,
  periodOf,
  timeFallback,
  isValidGreeting,
  readCache,
  writeCache,
  rotate,
  TTL_MS,
} from './greeting'

// 测试一律用中性假名（林 / 陈一 / 刘德彬 / 欧阳云帆 / 艾力·买买提），不入库真实人名。

describe('familiarName', () => {
  it.each([
    ['', '同学'],
    ['   ', '同学'],
    ['林', '林'],
    ['陈一', '陈一'],
    ['刘德彬', '德彬'],
    ['欧阳云帆', '云帆'],
    ['艾力·买买提', '艾力'],
    ['艾力·买买提·某段', '艾力'],
  ])('familiarName(%j) -> %j', (input, expected) => {
    expect(familiarName(input)).toBe(expected)
  })

  it('null / undefined -> 同学', () => {
    expect(familiarName(null)).toBe('同学')
    expect(familiarName(undefined)).toBe('同学')
  })
})

describe('periodOf — 全覆盖 0-23、无重叠', () => {
  it('每个小时都映射到唯一时段', () => {
    const map: Record<number, string> = {}
    for (let h = 0; h < 24; h++) map[h] = periodOf(h)
    expect(map[0]).toBe('凌晨')
    expect(map[4]).toBe('凌晨')
    expect(map[5]).toBe('早晨')
    expect(map[7]).toBe('早晨')
    expect(map[8]).toBe('上午')
    expect(map[10]).toBe('上午')
    expect(map[11]).toBe('中午')
    expect(map[12]).toBe('中午')
    expect(map[13]).toBe('下午')
    expect(map[17]).toBe('下午')
    expect(map[18]).toBe('晚上')
    expect(map[21]).toBe('晚上')
    expect(map[22]).toBe('深夜')
    expect(map[23]).toBe('深夜')
  })
})

describe('timeFallback', () => {
  it('注入称呼、单行、过自身校验', () => {
    const addr = familiarName('欧阳云帆')
    const line = timeFallback(addr)
    expect(line.includes('{名字}')).toBe(false)
    expect(line.includes(addr)).toBe(true)
    expect(line.includes('\n')).toBe(false)
    expect(isValidGreeting(line, addr)).toBe(true)
  })
})

describe('isValidGreeting — 退化校验', () => {
  const addr = '云帆'

  it.each([
    ['', '空'],
    ['   ', '纯空白'],
    ['。。。', '纯标点'],
    ['，，', '纯标点 2'],
    ['陈', '单字'],
    ['云帆', '只剩称呼'],
    ['云帆，', '称呼+标点'],
    ['云帆！', '称呼+标点 2'],
    ['一二三\n四五六', '含换行'],
    ['一'.repeat(41), '超长 41'],
  ])('reject %j (%s)', (text) => {
    expect(isValidGreeting(text, addr)).toBe(false)
  })

  it.each([
    '云帆，早呀，新的一天开始啦。',
    '云帆，外面在下雪，记得加件衣服。',
    '云帆，下午好，起来走走、喝杯水吧。',
  ])('accept %j', (text) => {
    expect(isValidGreeting(text, addr)).toBe(true)
  })

  it('去引号后校验（前后引号不计入实义但单行约束保留）', () => {
    expect(isValidGreeting('“云帆，晚上好，今天辛苦啦。”', addr)).toBe(true)
  })
})

describe('缓存与轮换', () => {
  const sid = '20211010001'

  beforeEach(() => {
    localStorage.clear()
  })

  it('readCache 空时返回 null', () => {
    expect(readCache(sid)).toBeNull()
  })

  it('writeCache 后 readCache 命中，idx 从 0 开始', () => {
    writeCache(sid, ['a', 'b', 'c'])
    const c = readCache(sid)
    expect(c).not.toBeNull()
    expect(c!.lines).toEqual(['a', 'b', 'c'])
    expect(c!.idx).toBe(0)
  })

  it('rotate 轮换并持久化 idx，TTL 窗口不变', () => {
    writeCache(sid, ['a', 'b', 'c'])
    const at0 = readCache(sid)!.at
    expect(rotate(sid)).toBe('a')
    expect(readCache(sid)!.idx).toBe(1)
    expect(rotate(sid)).toBe('b')
    expect(rotate(sid)).toBe('c')
    expect(rotate(sid)).toBe('a') // 回绕
    expect(readCache(sid)!.at).toBe(at0) // at 不变
  })

  it('rotate 无缓存返回 null', () => {
    expect(rotate(sid)).toBeNull()
  })

  it('过期缓存视为 null', () => {
    const key = `labnotes.greeting.${sid}`
    localStorage.setItem(
      key,
      JSON.stringify({ lines: ['a', 'b'], at: Date.now() - TTL_MS - 1000, idx: 0 }),
    )
    expect(readCache(sid)).toBeNull()
    expect(rotate(sid)).toBeNull()
  })

  it('损坏 / 形态不合法 -> null', () => {
    const key = `labnotes.greeting.${sid}`
    localStorage.setItem(key, 'not-json')
    expect(readCache(sid)).toBeNull()
    localStorage.setItem(key, JSON.stringify({ lines: [], at: Date.now(), idx: 0 }))
    expect(readCache(sid)).toBeNull()
    localStorage.setItem(key, JSON.stringify({ lines: ['a'], at: 'x', idx: 0 }))
    expect(readCache(sid)).toBeNull()
  })
})
