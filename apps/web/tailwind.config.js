/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive', 'monospace'],
        retro: ['Silkscreen', 'monospace'],
        digits: ['VT323', 'monospace'],
      },
      colors: {
        tibia: {
          dark: '#121316',
          panel: '#1b1c22',
          surface: '#24252f',
          border: '#3c3e4c',
          highlight: '#525567',
          shadow: '#090a0c',
          parchment: {
            DEFAULT: '#dfd7c2',
            muted: '#9e9785',
            dark: '#6e695b',
          },
          gold: {
            DEFAULT: '#c89b3c',
            light: '#e8b855',
            dark: '#856420',
          },
          mana: {
            DEFAULT: '#2563eb',
            light: '#3b82f6',
            dark: '#1e40af',
          },
          blood: {
            DEFAULT: '#b91c1c',
            light: '#ef4444',
            dark: '#7f1d1d',
          },
          torch: {
            DEFAULT: '#d97706',
            light: '#f59e0b',
            dark: '#92400e',
          },
          soul: {
            DEFAULT: '#8b5cf6',
            light: '#a78bfa',
            dark: '#5b21b6',
          },
        },
      },
    },
  },
  plugins: [],
};
