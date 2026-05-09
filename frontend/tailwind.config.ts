import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

// Round 1: 仅锁定 v3 + 注册 animate 插件
// Round 2 会把 design tokens 通过 CSS 变量映射进 theme.extend
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 留给 Round 2 (tokens / colors / fontFamily / borderRadius / transitions)
    },
  },
  plugins: [animate],
}

export default config
