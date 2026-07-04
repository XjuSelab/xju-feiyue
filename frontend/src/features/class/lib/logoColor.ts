/**
 * 小组无 Logo 时的确定性底色 —— 由 gid 哈希到固定色板，同一小组永远
 * 同色（与 Header 头像首字母 fallback 同思路，但带颜色区分度）。
 * 色板取 tailwind 数值色的 600 档，深浅主题下白字都可读。
 */

export const LOGO_PALETTE = [
  '#0284c7', // sky-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#ea580c', // orange-600
  '#16a34a', // green-600
  '#0d9488', // teal-600
  '#4f46e5', // indigo-600
  '#ca8a04', // yellow-600
] as const

/** FNV-1a 32-bit —— 稳定、无依赖、离散度够用。 */
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function logoColor(gid: string): string {
  return LOGO_PALETTE[fnv1a(gid) % LOGO_PALETTE.length]!
}

/** Logo fallback 文本：组名前 2 个字符（中文名取前两字）。 */
export function logoInitials(name: string): string {
  return [...name.trim()].slice(0, 2).join('') || '组'
}
