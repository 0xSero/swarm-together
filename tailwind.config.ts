import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F14',
        surface: '#11161C',
        elevated: '#151B23',
        primary: '#5B9BFF',
        secondary: '#8B7CFF',
        accent: '#3CE2B3',
        success: '#33D69F',
        warning: '#FFB020',
        danger: '#FF6B6B',
        'text-high': '#E6EDF3',
        'text-muted': '#98A6B3',
        border: '#27303B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '10px',
        md: '12px',
        lg: '14px',
      },
    },
  },
  plugins: [],
} satisfies Config
