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
      keyframes: {
        'nx-bar':    { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        'nx-hdr':    { 'from': { opacity: '0', transform: 'translateY(-10px)' }, 'to': { opacity: '1', transform: 'translateY(0)' } },
        'nx-flash':  { '0%': { filter: 'brightness(2.2)', color: '#93c5fd' }, '100%': { filter: 'brightness(1)' } },
        'scanH':     { '0%': { top: '-2px', opacity: '0' }, '10%,90%': { opacity: '1' }, '100%': { top: '100%', opacity: '0' } },
        'floatY':    { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'pulseRing': { '0%': { transform: 'scale(1)', opacity: '0.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
      },
      animation: {
        'nx-bar':    'nx-bar 4s ease-in-out infinite',
        'nx-hdr':    'nx-hdr 0.45s cubic-bezier(.22,1,.36,1) 0.1s both',
        'nx-flash':  'nx-flash 0.65s ease forwards',
        'scanH':     'scanH 8s linear infinite',
        'floatY':    'floatY 2.4s ease-in-out infinite',
        'pulseRing': 'pulseRing 2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
