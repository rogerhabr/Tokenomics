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
        // AXIS LABS brand palette, sampled from the logo: royal-blue wordmark
        // over a deeper navy tagline, with the pale blues of the helix mark.
        axis: {
          navy: '#1B2A63',
          'navy-deep': '#121D47',
          blue: '#2E4C9E',
          'blue-hover': '#25407F',
          'blue-light': '#5C7FD0',
          helix: '#8FBEEA',
          tint: '#F2F5FC',
          'tint-strong': '#E4EBF8',
          surface: '#F7F9FD',
          card: '#FFFFFF',
          border: '#DFE6F3',
          'border-strong': '#C3CFE6',
          text: '#14203F',
          muted: '#5A6785',
          faint: '#8792AB',
          signal: '#0E9F6E',
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
