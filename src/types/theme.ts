/**
 * Task 130: Brand Kit and Theming
 * Design tokens and theme types for dark neumorphism
 */

// ============================================================================
// Theme Types
// ============================================================================

/**
 * Color token with variants
 */
export interface ColorToken {
  DEFAULT: string
  dark: string
  light: string
}

/**
 * Complete theme definition
 */
export interface Theme {
  name: string
  mode: 'dark' | 'light'

  colors: {
    // Base layers
    background: string
    surface: string
    elevated: string
    overlay: string

    // Brand
    primary: ColorToken
    secondary: ColorToken
    accent: ColorToken

    // Semantic
    success: ColorToken
    warning: ColorToken
    danger: ColorToken
    info: ColorToken

    // Text
    text: {
      high: string
      medium: string
      low: string
      muted: string
    }

    // Borders
    border: {
      DEFAULT: string
      light: string
      dark: string
    }
  }

  typography: {
    fontFamily: {
      sans: string
      mono: string
    }
    fontSize: {
      xs: string
      sm: string
      base: string
      lg: string
      xl: string
      '2xl': string
      '3xl': string
      '4xl': string
    }
    fontWeight: {
      normal: number
      medium: number
      semibold: number
      bold: number
    }
    lineHeight: {
      tight: number
      normal: number
      relaxed: number
    }
  }

  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    '2xl': string
  }

  borderRadius: {
    sm: string
    DEFAULT: string
    md: string
    lg: string
    xl: string
    '2xl': string
    full: string
  }

  shadows: {
    // Neumorphic
    'neu-sm': string
    'neu-md': string
    'neu-lg': string
    'neu-xl': string
    'neu-inset': string

    // Glows
    'glow-primary': string
    'glow-success': string
    'glow-warning': string
    'glow-danger': string
  }

  animation: {
    duration: {
      fast: string
      normal: string
      slow: string
    }
    easing: {
      linear: string
      in: string
      out: string
      inOut: string
    }
  }
}

// ============================================================================
// Default Dark Neumorphic Theme
// ============================================================================

export const darkNeumorphicTheme: Theme = {
  name: 'Dark Neumorphic',
  mode: 'dark',

  colors: {
    background: '#0B0F14',
    surface: '#11161C',
    elevated: '#151B23',
    overlay: '#1A2029',

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
    text: {
      high: '#E6EDF3',
      medium: '#C5D1DC',
      low: '#98A6B3',
      muted: '#7D8A96',
    },
    border: {
      DEFAULT: '#27303B',
      light: '#3A4554',
      dark: '#1A2029',
    },
  },

  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: 'JetBrains Mono, Fira Code, Consolas, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },

  borderRadius: {
    sm: '8px',
    DEFAULT: '10px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    full: '9999px',
  },

  shadows: {
    'neu-sm': '4px 4px 8px rgba(0, 0, 0, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.02)',
    'neu-md': '6px 6px 12px rgba(0, 0, 0, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.02)',
    'neu-lg': '8px 8px 16px rgba(0, 0, 0, 0.5), -8px -8px 16px rgba(255, 255, 255, 0.03)',
    'neu-xl': '12px 12px 24px rgba(0, 0, 0, 0.6), -12px -12px 24px rgba(255, 255, 255, 0.03)',
    'neu-inset': 'inset 4px 4px 8px rgba(0, 0, 0, 0.4), inset -4px -4px 8px rgba(255, 255, 255, 0.02)',
    'glow-primary': '0 0 20px rgba(91, 155, 255, 0.3)',
    'glow-success': '0 0 20px rgba(51, 214, 159, 0.3)',
    'glow-warning': '0 0 20px rgba(255, 176, 32, 0.3)',
    'glow-danger': '0 0 20px rgba(255, 107, 107, 0.3)',
  },

  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    easing: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
}

// ============================================================================
// Color Contrast Utilities (WCAG)
// ============================================================================

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Calculate relative luminance (WCAG formula)
 */
export function getLuminance(rgb: { r: number; g: number; b: number }): number {
  const rsRGB = rgb.r / 255
  const gsRGB = rgb.g / 255
  const bsRGB = rgb.b / 255

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4)
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4)
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  if (!rgb1 || !rgb2) return 0

  const lum1 = getLuminance(rgb1)
  const lum2 = getLuminance(rgb2)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * WCAG compliance levels
 */
export enum WCAGLevel {
  AAA = 'AAA', // Contrast ratio >= 7:1 for normal text, >= 4.5:1 for large text
  AA = 'AA', // Contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text
  FAIL = 'FAIL', // Does not meet minimum requirements
}

/**
 * Check if contrast meets WCAG standard
 */
export function checkContrast(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): { ratio: number; level: WCAGLevel; passes: boolean } {
  const ratio = getContrastRatio(foreground, background)

  const aaaThreshold = isLargeText ? 4.5 : 7
  const aaThreshold = isLargeText ? 3 : 4.5

  let level: WCAGLevel
  if (ratio >= aaaThreshold) {
    level = WCAGLevel.AAA
  } else if (ratio >= aaThreshold) {
    level = WCAGLevel.AA
  } else {
    level = WCAGLevel.FAIL
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    level,
    passes: level !== WCAGLevel.FAIL,
  }
}

/**
 * Validate all text colors in theme against backgrounds
 */
export function validateThemeContrast(theme: Theme): Array<{
  pair: string
  foreground: string
  background: string
  ratio: number
  level: WCAGLevel
  passes: boolean
}> {
  const results: Array<{
    pair: string
    foreground: string
    background: string
    ratio: number
    level: WCAGLevel
    passes: boolean
  }> = []

  const backgrounds = [theme.colors.background, theme.colors.surface, theme.colors.elevated]
  const textColors = [
    { name: 'text-high', color: theme.colors.text.high },
    { name: 'text-medium', color: theme.colors.text.medium },
    { name: 'text-low', color: theme.colors.text.low },
    { name: 'text-muted', color: theme.colors.text.muted },
  ]

  for (const bg of backgrounds) {
    for (const text of textColors) {
      const check = checkContrast(text.color, bg)
      results.push({
        pair: `${text.name} on ${bg}`,
        foreground: text.color,
        background: bg,
        ...check,
      })
    }
  }

  return results
}

/**
 * Log theme contrast warnings
 */
export function logThemeWarnings(theme: Theme): void {
  const results = validateThemeContrast(theme)
  const failures = results.filter((r) => !r.passes)

  if (failures.length > 0) {
    console.warn('[Theme] WCAG contrast failures detected:')
    failures.forEach((f) => {
      console.warn(`  ${f.pair}: ${f.ratio}:1 (${f.level})`)
    })
  } else {
    console.log('[Theme] All contrast checks passed ✓')
  }
}
