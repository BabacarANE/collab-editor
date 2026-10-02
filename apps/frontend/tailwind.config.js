/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette inspirée de Notion (neutres chauds) et Google Docs (bleu d'action)
        ink: { DEFAULT: '#37352f', soft: '#5f5e5b', muted: '#91918e' },
        line: { DEFAULT: '#e9e9e7', strong: '#d3d3d1' },
        sidebar: '#f7f7f5',
        hover: 'rgba(55, 53, 47, 0.06)',
        canvas: '#f1f3f4',
        accent: { DEFAULT: '#1a73e8', hover: '#1765cc', soft: '#e8f0fe' },
        primary: '#1a73e8',
        'primary-hover': '#1557b0',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        serif: ['Lyon-Text', 'Georgia', 'ui-serif', 'serif'],
      },
      boxShadow: {
        page: '0 1px 3px 1px rgba(60,64,67,.15), 0 1px 2px rgba(60,64,67,.3)',
        pop: '0 0 0 1px rgba(15,15,15,.05), 0 3px 6px rgba(15,15,15,.1), 0 9px 24px rgba(15,15,15,.2)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(.97) translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(12px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in .12s ease-out',
        'pop-in': 'pop-in .14s ease-out',
        'slide-in': 'slide-in .16s ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
