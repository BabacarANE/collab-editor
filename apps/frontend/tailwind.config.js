/** @type {import('tailwindcss').Config} */

// Toutes les couleurs viennent de src/styles/tokens.css (clair + sombre).
const token = name => `oklch(var(--c-${name}) / <alpha-value>)`

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: token('surface'),
        raised: token('raised'),
        canvas: token('canvas'),
        sidebar: token('sidebar'),
        ink: { DEFAULT: token('ink'), soft: token('ink-soft'), muted: token('ink-muted') },
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        control: token('control'),
        hover: 'oklch(var(--c-hover) / var(--hover-alpha))',
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          soft: token('accent-soft'),
          ink: token('accent-ink'),
        },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
        highlight: token('highlight'),
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        page: 'var(--shadow-page)',
        pop: 'var(--shadow-pop)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(.97) translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(12px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in var(--dur-fast) var(--ease-out)',
        'pop-in': 'pop-in var(--dur-base) var(--ease-out)',
        'slide-in': 'slide-in var(--dur-base) var(--ease-out)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
