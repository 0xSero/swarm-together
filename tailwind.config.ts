import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Base layers - Dark Neumorphism
        background: '#0B0F14',
        surface: '#11161C',
        elevated: '#151B23',
        overlay: '#1A2029',

        // Brand colors
        primary: {
          DEFAULT: '#5B9BFF',
          dark: '#4585E8',
          light: '#73ABFF',
        },
        secondary: {
          DEFAULT: '#8B7CFF',
          dark: '#7565E8',
          light: '#9D8DFF',
        },
        accent: {
          DEFAULT: '#3CE2B3',
          dark: '#2CC99D',
          light: '#52E8BD',
        },

        // Semantic colors
        success: {
          DEFAULT: '#33D69F',
          dark: '#2ABF8B',
          light: '#47DBA9',
        },
        warning: {
          DEFAULT: '#FFB020',
          dark: '#E89E1C',
          light: '#FFC04D',
        },
        danger: {
          DEFAULT: '#FF6B6B',
          dark: '#E85757',
          light: '#FF8282',
        },
        info: {
          DEFAULT: '#5B9BFF',
          dark: '#4585E8',
          light: '#73ABFF',
        },

        // Text hierarchy
        text: {
          high: '#E6EDF3',
          medium: '#C5D1DC',
          low: '#98A6B3',
          muted: '#7D8A96',
        },

        // Borders
        border: {
          DEFAULT: '#27303B',
          light: '#3A4554',
          dark: '#1A2029',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        'sm': '8px',
        'DEFAULT': '10px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
      },
      boxShadow: {
        // Neumorphic shadows - soft depth
        'neu-sm': '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.02)',
        'neu-md': '6px 6px 12px rgba(0, 0, 0, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.02)',
        'neu-lg': '8px 8px 16px rgba(0, 0, 0, 0.5), -8px -8px 16px rgba(255, 255, 255, 0.03)',
        'neu-xl': '12px 12px 24px rgba(0, 0, 0, 0.6), -12px -12px 24px rgba(255, 255, 255, 0.03)',

        // Inset shadows for pressed state
        'neu-inset': 'inset 4px 4px 8px rgba(0, 0, 0, 0.4), inset -4px -4px 8px rgba(255, 255, 255, 0.02)',

        // Glow effects
        'glow-primary': '0 0 20px rgba(91, 155, 255, 0.3)',
        'glow-success': '0 0 20px rgba(51, 214, 159, 0.3)',
        'glow-warning': '0 0 20px rgba(255, 176, 32, 0.3)',
        'glow-danger': '0 0 20px rgba(255, 107, 107, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
