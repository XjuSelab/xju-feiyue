import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

/**
 * Round 2 design-system tailwind config.
 *
 * 颜色映射策略：
 * - 业务自定义 utilities (bg-text, text-cat-research, ...) 直接 var(--color-*)
 *   透传 hex / rgba。
 * - shadcn 语义槽位 (background / foreground / primary / ...) 用
 *   hsl(var(--xx) / <alpha-value>) 形式，桥接变量在 src/styles/globals.css
 *   :root 中以 HSL 形式给出，与 tokens.css 单一色源对齐。
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // === LabNotes business tokens (hex/rgba via CSS vars) ===
        bg: 'var(--color-bg)',
        'bg-subtle': 'var(--color-bg-subtle)',
        'bg-hover': 'var(--bg-hover)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'text-faint': 'var(--color-text-faint)',
        'border-strong': 'var(--line-strong)',
        link: 'var(--color-link)',

        'cat-research': 'var(--cat-research)',
        'cat-course': 'var(--cat-course)',
        'cat-recommend': 'var(--cat-recommend)',
        'cat-competition': 'var(--cat-competition)',
        'cat-kaggle': 'var(--cat-kaggle)',
        'cat-tools': 'var(--cat-tools)',
        'cat-life': 'var(--cat-life)',

        'tag-research': 'var(--tag-research-bg)',
        'tag-course': 'var(--tag-course-bg)',
        'tag-recommend': 'var(--tag-recommend-bg)',
        'tag-competition': 'var(--tag-competition-bg)',
        'tag-kaggle': 'var(--tag-kaggle-bg)',
        'tag-tools': 'var(--tag-tools-bg)',
        'tag-life': 'var(--tag-life-bg)',

        'ai-add-fg': 'var(--ai-add-fg)',
        'ai-add-bg': 'var(--ai-add-bg)',
        'ai-add-border': 'var(--ai-add-border)',
        'ai-del-fg': 'var(--ai-del-fg)',
        'ai-del-bg': 'var(--ai-del-bg)',
        'ai-del-border': 'var(--ai-del-border)',

        // === shadcn semantic slots (HSL form) ===
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}

export default config
