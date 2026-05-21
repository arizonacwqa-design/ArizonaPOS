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
        // CSS-variable backed so the whole palette flips when .theme-light is
        // added to <html>. Each entry uses `rgb(var(--x) / <alpha-value>)` so
        // opacity utilities like bg-luxury-black/70 keep working.
        luxury: {
          black: 'rgb(var(--luxury-black) / <alpha-value>)',
          charcoal: 'rgb(var(--luxury-charcoal) / <alpha-value>)',
          slate: 'rgb(var(--luxury-slate) / <alpha-value>)',
          border: 'rgb(var(--luxury-border) / <alpha-value>)',
          muted: 'rgb(var(--luxury-muted) / <alpha-value>)',
          foreground: 'rgb(var(--luxury-foreground) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 30px rgba(201, 162, 39, 0.15)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
