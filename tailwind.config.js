/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Dashboard theme (unchanged — the tokenomics dashboard at /dashboard
        // is a separate surface and none of the AXIS LABS work touches it).
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

        // AXIS LABS.
        //
        // There is no decorative accent in this palette. Colour on the
        // marketing surface means exactly one thing — that a lot passed, was
        // retained, or was rejected — so the primary call to action is filled
        // with ink rather than with a brand colour. Every value below resolves
        // through a CSS custom property so `prefers-color-scheme: dark` can
        // re-point the whole system by redefining tokens in one place.
        axis: {
          paper: 'var(--paper)',
          sunk: 'var(--paper-sunk)',
          plate: 'var(--plate)',

          ink: 'var(--ink-900)',
          'ink-700': 'var(--ink-700)',
          'ink-500': 'var(--ink-500)',
          'ink-300': 'var(--ink-300)',

          // rule-1 and rule-2 are decorative and deliberately below 3:1 — they
          // may never carry meaning on their own. rule-3 clears 3:1 against
          // paper, sunk and plate, so every border that signals state uses it.
          'rule-1': 'var(--rule-1)',
          'rule-2': 'var(--rule-2)',
          'rule-3': 'var(--rule-3)',

          released: 'var(--released)',
          retained: 'var(--retained)',
          rejected: 'var(--rejected)',
        },
      },
      fontFamily: {
        // Dashboard.
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        // AXIS LABS: a grotesk for language, a mono for data. The mono is a
        // semantic role, not a texture — see globals.css.
        grot: ['var(--font-grot)', 'system-ui', 'sans-serif'],
        data: ['var(--font-data)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        site: '1200px',
        content: 'var(--content)',
        measure: 'var(--measure)',
      },
      borderRadius: {
        // The only radius on the marketing surface. 0 reads as unstyled and
        // rounded-xl reads as a UI kit; 2px reads as machined.
        plate: '2px',
      },
    },
  },
  plugins: [],
};
