/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        display: ['Poppins', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        accent: { pink: '#ec4899', yellow: '#facc15' },
        slate: { 950: '#0b0b12' },
      },
      backgroundImage: {
        'hero-radial': 'radial-gradient(circle at 30% 30%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(circle at 70% 60%, rgba(236,72,153,0.25), transparent 60%)',
        'gradient-brand': 'linear-gradient(135deg,#4c1d95 0%,#6d28d9 25%,#7c3aed 50%,#ec4899 75%,#f59e0b 100%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,58,237,0.3), 0 0 25px -5px rgba(124,58,237,0.6)',
      },
      animation: { 'fade-in': 'fadeIn .6s ease-out' },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
