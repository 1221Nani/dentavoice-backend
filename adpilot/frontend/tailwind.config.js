/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#060509',
          900: '#0A0A0F',
          800: '#121017',
          700: '#1C1926',
          600: '#2A2635',
        },
        aurora: {
          amber: '#FFB020',
          coral: '#FF6B3D',
          violet: '#C24FE0',
          indigo: '#7C5CE0',
          blue: '#3FA9F5',
          cyan: '#3FC6E0',
        },
        ink: {
          50: '#F5F3F8',
          300: '#D8D4E0',
          500: '#A9A4B8',
          700: '#6B6578',
        },
      },
      boxShadow: {
        'glow-amber': '0 0 0 1px rgba(255,176,32,0.2), 0 0 28px rgba(255,176,32,0.32), inset 0 0 14px rgba(255,176,32,0.1)',
        'glow-blue': '0 0 0 1px rgba(63,169,245,0.22), 0 0 22px rgba(63,169,245,0.3), inset 0 0 12px rgba(63,169,245,0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
