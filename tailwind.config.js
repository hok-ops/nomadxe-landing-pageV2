// Pinned to Tailwind v3.x — do not upgrade to v4 without migration guide.
// Theme: "Midnight Blue" — replaced amber accent with sky blue (#0EA5E9)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        midnight: '#0B0C10',
        surface: '#13151A',
        // Primary accent: sky blue that matches the trailer-photo sky
        blue: {
          DEFAULT: '#0EA5E9',
          dark:    '#0284C7',
          light:   '#38BDF8',
          glow:    'rgba(14, 165, 233, 0.25)',
        },
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        mono:    ['var(--font-jetbrains)', 'monospace'],
      },
      borderRadius: {
        '2xl': '2rem',
        '3xl': '3rem',
      },
      boxShadow: {
        'blue-glow':    '0 0 18px rgba(14, 165, 233, 0.25)',
        'blue-glow-lg': '0 0 40px rgba(14, 165, 233, 0.20)',
      },
    },
  },
  plugins: [],
};
