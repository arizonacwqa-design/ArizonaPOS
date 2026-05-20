/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdf9ef',
          100: '#f9efd4',
          200: '#f2dda8',
          300: '#e9c571',
          400: '#dfa83a',
          500: '#c9a227',
          600: '#a8841f',
          700: '#86661a',
          800: '#6f5219',
          900: '#5c4418',
        },
        luxury: {
          black: '#0a0a0a',
          charcoal: '#141414',
          slate: '#1c1c1c',
          border: '#2a2a2a',
          muted: '#888888',
        },
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        sans: ['Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 30px rgba(201, 162, 39, 0.15)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
