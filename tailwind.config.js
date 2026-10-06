/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './index.html', './src/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          900: 'rgb(var(--c-bg-900) / <alpha-value>)',
          800: 'rgb(var(--c-bg-800) / <alpha-value>)',
          700: 'rgb(var(--c-bg-700) / <alpha-value>)',
          600: 'rgb(var(--c-bg-600) / <alpha-value>)',
          500: 'rgb(var(--c-bg-500) / <alpha-value>)'
        },
        /* translucent surface fills — white on dark, warm tint on light */
        surface: {
          soft: 'rgb(var(--c-surface) / var(--sa-soft))',
          DEFAULT: 'rgb(var(--c-surface) / var(--sa-base))',
          strong: 'rgb(var(--c-surface) / var(--sa-strong))',
          hi: 'rgb(var(--c-surface) / var(--sa-hi))'
        },
        glass: {
          DEFAULT: 'rgb(var(--c-glass) / var(--ga-base))',
          strong: 'rgb(var(--c-glass) / var(--ga-strong))'
        },
        line: {
          DEFAULT: 'rgb(var(--c-line) / var(--la-base))',
          strong: 'rgb(var(--c-line) / var(--la-strong))'
        },
        accent: {
          300: 'rgb(var(--c-accent-300) / <alpha-value>)',
          400: 'rgb(var(--c-accent-400) / <alpha-value>)',
          500: 'rgb(var(--c-accent-500) / <alpha-value>)',
          600: 'rgb(var(--c-accent-600) / <alpha-value>)'
        },
        /* text color sitting on top of the accent gradient face */
        'accent-ink': 'rgb(var(--c-accent-ink) / <alpha-value>)',
        scrim: 'rgb(var(--c-scrim) / var(--scrim-a))',
        violet: { 400: 'rgb(var(--c-violet-400) / <alpha-value>)' },
        teal: { 400: 'rgb(var(--c-teal-400) / <alpha-value>)' },
        rose: { 400: 'rgb(var(--c-rose-400) / <alpha-value>)' },
        ink: {
          high: 'rgb(var(--c-ink) / <alpha-value>)',
          med: 'rgb(var(--c-ink) / 0.66)',
          low: 'rgb(var(--c-ink) / 0.42)'
        },
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        well: {
          DEFAULT: 'rgb(var(--c-well) / <alpha-value>)',
          track: 'rgb(var(--c-track) / <alpha-value>)'
        }
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif']
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
        '4xl': '32px'
      },
      boxShadow: {
        soft: 'var(--shadow-raised), var(--shadow-rim)',
        raised: 'var(--shadow-raised), var(--shadow-rim)',
        inset: 'var(--shadow-inset)',
        glow: 'var(--shadow-glow)',
        cta: 'var(--shadow-cta), var(--shadow-rim)',
        pressed: 'var(--shadow-pressed)',
        pop: 'var(--shadow-pop)',
        modal: 'var(--shadow-modal)'
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.34,1.56,.64,1)'
      },
      keyframes: {
        auroraDrift: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(4%, -6%, 0) scale(1.12)' }
        },
        auroraDrift2: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.05)' },
          '50%': { transform: 'translate3d(-5%, 4%, 0) scale(1)' }
        },
        shimmer: {
          '100%': { transform: 'translateX(-200%)' }
        },
        sheen: {
          '0%': { transform: 'translateX(-130%) skewX(-18deg)' },
          '100%': { transform: 'translateX(230%) skewX(-18deg)' }
        }
      },
      animation: {
        aurora: 'auroraDrift 22s ease-in-out infinite',
        aurora2: 'auroraDrift2 28s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        sheen: 'sheen 0.9s var(--ease-out)'
      }
    }
  },
  plugins: []
}
