/**
 * Task 130: Theme Provider
 * React context for theme management with runtime token overrides
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Theme } from '@/types/theme'
import { darkNeumorphicTheme, logThemeWarnings } from '@/types/theme'

// ============================================================================
// Theme Context
// ============================================================================

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  overrideToken: (path: string, value: any) => void
  resetOverrides: () => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// ============================================================================
// Theme Provider Props
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  enableWarnings?: boolean
}

// ============================================================================
// Theme Provider Component
// ============================================================================

export function ThemeProvider({
  children,
  defaultTheme = darkNeumorphicTheme,
  enableWarnings = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [overrides, setOverrides] = useState<Record<string, any>>({})

  // Apply theme to document
  useEffect(() => {
    applyThemeToDom(theme, overrides)

    // Log contrast warnings in development
    if (enableWarnings && process.env.NODE_ENV === 'development') {
      logThemeWarnings(theme)
    }
  }, [theme, overrides, enableWarnings])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    setOverrides({})
  }

  const overrideToken = (path: string, value: any) => {
    setOverrides((prev) => ({
      ...prev,
      [path]: value,
    }))

    if (enableWarnings) {
      console.log(`[Theme] Token override: ${path} = ${value}`)
    }
  }

  const resetOverrides = () => {
    setOverrides({})
  }

  const toggleMode = () => {
    // Future: implement light mode variant
    console.warn('[Theme] Light mode not yet implemented')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, overrideToken, resetOverrides, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ============================================================================
// Theme Hook
// ============================================================================

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

// ============================================================================
// Apply Theme to DOM
// ============================================================================

function applyThemeToDom(theme: Theme, overrides: Record<string, any>) {
  const root = document.documentElement

  // Base layers
  root.style.setProperty('--color-background', getTokenValue(theme, 'colors.background', overrides))
  root.style.setProperty('--color-surface', getTokenValue(theme, 'colors.surface', overrides))
  root.style.setProperty('--color-elevated', getTokenValue(theme, 'colors.elevated', overrides))
  root.style.setProperty('--color-overlay', getTokenValue(theme, 'colors.overlay', overrides))

  // Brand colors
  setCSSColorToken(root, 'primary', theme.colors.primary, overrides)
  setCSSColorToken(root, 'secondary', theme.colors.secondary, overrides)
  setCSSColorToken(root, 'accent', theme.colors.accent, overrides)

  // Semantic colors
  setCSSColorToken(root, 'success', theme.colors.success, overrides)
  setCSSColorToken(root, 'warning', theme.colors.warning, overrides)
  setCSSColorToken(root, 'danger', theme.colors.danger, overrides)
  setCSSColorToken(root, 'info', theme.colors.info, overrides)

  // Text
  root.style.setProperty('--color-text-high', theme.colors.text.high)
  root.style.setProperty('--color-text-medium', theme.colors.text.medium)
  root.style.setProperty('--color-text-low', theme.colors.text.low)
  root.style.setProperty('--color-text-muted', theme.colors.text.muted)

  // Borders
  root.style.setProperty('--color-border', theme.colors.border.DEFAULT)
  root.style.setProperty('--color-border-light', theme.colors.border.light)
  root.style.setProperty('--color-border-dark', theme.colors.border.dark)

  // Typography
  root.style.setProperty('--font-sans', theme.typography.fontFamily.sans)
  root.style.setProperty('--font-mono', theme.typography.fontFamily.mono)

  // Spacing
  root.style.setProperty('--spacing-xs', theme.spacing.xs)
  root.style.setProperty('--spacing-sm', theme.spacing.sm)
  root.style.setProperty('--spacing-md', theme.spacing.md)
  root.style.setProperty('--spacing-lg', theme.spacing.lg)
  root.style.setProperty('--spacing-xl', theme.spacing.xl)
  root.style.setProperty('--spacing-2xl', theme.spacing['2xl'])

  // Border radius
  root.style.setProperty('--radius-sm', theme.borderRadius.sm)
  root.style.setProperty('--radius', theme.borderRadius.DEFAULT)
  root.style.setProperty('--radius-md', theme.borderRadius.md)
  root.style.setProperty('--radius-lg', theme.borderRadius.lg)
  root.style.setProperty('--radius-xl', theme.borderRadius.xl)
  root.style.setProperty('--radius-2xl', theme.borderRadius['2xl'])

  // Shadows
  root.style.setProperty('--shadow-neu-sm', theme.shadows['neu-sm'])
  root.style.setProperty('--shadow-neu-md', theme.shadows['neu-md'])
  root.style.setProperty('--shadow-neu-lg', theme.shadows['neu-lg'])
  root.style.setProperty('--shadow-neu-xl', theme.shadows['neu-xl'])
  root.style.setProperty('--shadow-neu-inset', theme.shadows['neu-inset'])
  root.style.setProperty('--shadow-glow-primary', theme.shadows['glow-primary'])
  root.style.setProperty('--shadow-glow-success', theme.shadows['glow-success'])
  root.style.setProperty('--shadow-glow-warning', theme.shadows['glow-warning'])
  root.style.setProperty('--shadow-glow-danger', theme.shadows['glow-danger'])

  // Animation
  root.style.setProperty('--duration-fast', theme.animation.duration.fast)
  root.style.setProperty('--duration-normal', theme.animation.duration.normal)
  root.style.setProperty('--duration-slow', theme.animation.duration.slow)
}

function setCSSColorToken(
  root: HTMLElement,
  name: string,
  token: { DEFAULT: string; dark: string; light: string },
  overrides: Record<string, any>
) {
  root.style.setProperty(`--color-${name}`, getTokenValue({ colors: { [name]: token } }, `colors.${name}.DEFAULT`, overrides))
  root.style.setProperty(`--color-${name}-dark`, getTokenValue({ colors: { [name]: token } }, `colors.${name}.dark`, overrides))
  root.style.setProperty(`--color-${name}-light`, getTokenValue({ colors: { [name]: token } }, `colors.${name}.light`, overrides))
}

function getTokenValue(obj: any, path: string, overrides: Record<string, any>): any {
  // Check overrides first
  if (overrides[path] !== undefined) {
    return overrides[path]
  }

  // Navigate path
  const keys = path.split('.')
  let value = obj
  for (const key of keys) {
    value = value?.[key]
    if (value === undefined) break
  }
  return value
}

// ============================================================================
// Neumorphic Component Utilities
// ============================================================================

/**
 * Get neumorphic button classes
 */
export function neuButton(variant: 'primary' | 'secondary' | 'danger' = 'primary') {
  const base = 'px-4 py-2 rounded-md font-medium transition-all duration-200 shadow-neu-md hover:shadow-neu-lg active:shadow-neu-inset'

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-light',
    secondary: 'bg-surface text-text-high hover:bg-elevated',
    danger: 'bg-danger text-white hover:bg-danger-light',
  }

  return `${base} ${variants[variant]}`
}

/**
 * Get neumorphic card classes
 */
export function neuCard(elevated: boolean = false) {
  return `rounded-lg shadow-neu-md ${elevated ? 'bg-elevated' : 'bg-surface'} border border-border transition-shadow hover:shadow-neu-lg`
}

/**
 * Get neumorphic input classes
 */
export function neuInput() {
  return 'px-3 py-2 bg-surface border border-border rounded-md shadow-neu-inset text-text-high placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:shadow-glow-primary transition-all'
}
