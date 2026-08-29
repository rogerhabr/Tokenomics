/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Dashboard theme (existing)
        sa: {
          bg: '#080c16',
          surface: '#0f1623',
          card: '#141b2d',
          border: '#1e2a42',
          accent: '#f97316',
          'accent-hover': '#ea580c',
          muted: '#64748b',
          green: '#10b981',
          red: '#ef4444',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          yellow: '#f59e0b',
        },
        // AXIS LABS brand theme. Swap `accent`/`accent2` for the real logo
        // colors once the artwork lands — nothing else needs to change.
        axis: {
          ink: '#08090C',
          surface: '#0D0F14',
          card: '#12151C',
          elevated: '#181C25',
          border: '#232833',
          'border-strong': '#333A49',
          text: '#ECEEF2',
          muted: '#8B93A3',
          faint: '#5A6172',
          accent: '#4F7DFF',
          'accent-hover': '#6B92FF',
          accent2: '#7C5CFF',
          signal: '#34D399',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      maxWidth: {
        site: '1200px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
      },
    },
  },
  plugins: [],
};
