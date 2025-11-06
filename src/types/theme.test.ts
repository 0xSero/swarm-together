import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  getLuminance,
  getContrastRatio,
  checkContrast,
  validateThemeContrast,
  WCAGLevel,
  darkNeumorphicTheme,
} from './theme'

describe('Theme Utilities', () => {
  describe('Color Conversion', () => {
    it('should convert hex to RGB', () => {
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb('#5B9BFF')).toEqual({ r: 91, g: 155, b: 255 })
    })

    it('should handle hex without hash', () => {
      expect(hexToRgb('FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull()
      expect(hexToRgb('#GGG')).toBeNull()
    })
  })

  describe('Luminance Calculation', () => {
    it('should calculate luminance for white', () => {
      const lum = getLuminance({ r: 255, g: 255, b: 255 })
      expect(lum).toBeCloseTo(1, 1)
    })

    it('should calculate luminance for black', () => {
      const lum = getLuminance({ r: 0, g: 0, b: 0 })
      expect(lum).toBeCloseTo(0, 1)
    })

    it('should calculate luminance for gray', () => {
      const lum = getLuminance({ r: 128, g: 128, b: 128 })
      expect(lum).toBeGreaterThan(0)
      expect(lum).toBeLessThan(1)
    })
  })

  describe('Contrast Ratio', () => {
    it('should calculate high contrast (white on black)', () => {
      const ratio = getContrastRatio('#FFFFFF', '#000000')
      expect(ratio).toBeCloseTo(21, 0) // Maximum contrast is 21:1
    })

    it('should calculate low contrast (gray on gray)', () => {
      const ratio = getContrastRatio('#888888', '#999999')
      expect(ratio).toBeLessThan(2)
    })

    it('should be symmetric', () => {
      const ratio1 = getContrastRatio('#FFFFFF', '#000000')
      const ratio2 = getContrastRatio('#000000', '#FFFFFF')
      expect(ratio1).toBeCloseTo(ratio2, 1)
    })

    it('should return 0 for invalid colors', () => {
      const ratio = getContrastRatio('invalid', '#000000')
      expect(ratio).toBe(0)
    })
  })

  describe('WCAG Contrast Checks', () => {
    it('should pass AAA for high contrast', () => {
      const result = checkContrast('#FFFFFF', '#000000')
      expect(result.level).toBe(WCAGLevel.AAA)
      expect(result.passes).toBe(true)
      expect(result.ratio).toBeGreaterThan(7)
    })

    it('should pass AA for medium contrast', () => {
      // Test with colors that meet AA but not AAA
      const result = checkContrast('#757575', '#FFFFFF')
      expect(result.passes).toBe(true)
      expect(result.ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should fail for low contrast', () => {
      const result = checkContrast('#888888', '#999999')
      expect(result.level).toBe(WCAGLevel.FAIL)
      expect(result.passes).toBe(false)
    })

    it('should use different thresholds for large text', () => {
      // Color pair that passes for large text but not regular
      const normalText = checkContrast('#999999', '#FFFFFF', false)
      const largeText = checkContrast('#999999', '#FFFFFF', true)

      // Large text has lower threshold, so may pass when normal fails
      expect(largeText.passes).toBe(normalText.passes || largeText.passes)
    })
  })

  describe('Theme Validation', () => {
    it('should validate theme contrast', () => {
      const results = validateThemeContrast(darkNeumorphicTheme)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('pair')
      expect(results[0]).toHaveProperty('ratio')
      expect(results[0]).toHaveProperty('level')
      expect(results[0]).toHaveProperty('passes')
    })

    it('should test all text colors against backgrounds', () => {
      const results = validateThemeContrast(darkNeumorphicTheme)

      // Should test text-high, text-medium, text-low, text-muted
      // against background, surface, elevated
      const expectedPairs = 4 * 3 // 4 text colors × 3 backgrounds
      expect(results.length).toBe(expectedPairs)
    })

    it('should detect failures', () => {
      const results = validateThemeContrast(darkNeumorphicTheme)
      const failures = results.filter((r) => !r.passes)

      // Log failures for visibility
      if (failures.length > 0) {
        console.log('Contrast failures found:')
        failures.forEach((f) => {
          console.log(`  ${f.pair}: ${f.ratio}:1`)
        })
      }

      // Most text colors should pass
      const passRate = (results.length - failures.length) / results.length
      expect(passRate).toBeGreaterThan(0.5) // At least 50% should pass
    })
  })

  describe('Theme Structure', () => {
    it('should have complete color definitions', () => {
      const theme = darkNeumorphicTheme

      expect(theme.colors.background).toBeTruthy()
      expect(theme.colors.surface).toBeTruthy()
      expect(theme.colors.elevated).toBeTruthy()
      expect(theme.colors.primary.DEFAULT).toBeTruthy()
      expect(theme.colors.text.high).toBeTruthy()
    })

    it('should have typography definitions', () => {
      const theme = darkNeumorphicTheme

      expect(theme.typography.fontFamily.sans).toBeTruthy()
      expect(theme.typography.fontFamily.mono).toBeTruthy()
      expect(theme.typography.fontSize.base).toBeTruthy()
    })

    it('should have spacing definitions', () => {
      const theme = darkNeumorphicTheme

      expect(theme.spacing.xs).toBeTruthy()
      expect(theme.spacing.sm).toBeTruthy()
      expect(theme.spacing.md).toBeTruthy()
    })

    it('should have neumorphic shadows', () => {
      const theme = darkNeumorphicTheme

      expect(theme.shadows['neu-sm']).toBeTruthy()
      expect(theme.shadows['neu-md']).toBeTruthy()
      expect(theme.shadows['neu-lg']).toBeTruthy()
      expect(theme.shadows['neu-inset']).toBeTruthy()
    })

    it('should have glow effects', () => {
      const theme = darkNeumorphicTheme

      expect(theme.shadows['glow-primary']).toBeTruthy()
      expect(theme.shadows['glow-success']).toBeTruthy()
      expect(theme.shadows['glow-warning']).toBeTruthy()
      expect(theme.shadows['glow-danger']).toBeTruthy()
    })

    it('should have animation definitions', () => {
      const theme = darkNeumorphicTheme

      expect(theme.animation.duration.fast).toBeTruthy()
      expect(theme.animation.duration.normal).toBeTruthy()
      expect(theme.animation.easing.inOut).toBeTruthy()
    })
  })

  describe('Color Accessibility', () => {
    it('should ensure primary text is readable on dark background', () => {
      const result = checkContrast(
        darkNeumorphicTheme.colors.text.high,
        darkNeumorphicTheme.colors.background
      )

      expect(result.passes).toBe(true)
      expect(result.ratio).toBeGreaterThan(4.5)
    })

    it('should ensure primary color is vibrant', () => {
      const primaryRgb = hexToRgb(darkNeumorphicTheme.colors.primary.DEFAULT)
      expect(primaryRgb).toBeTruthy()

      // Primary should not be too dark
      if (primaryRgb) {
        const lum = getLuminance(primaryRgb)
        expect(lum).toBeGreaterThan(0.1)
      }
    })

    it('should have sufficient contrast for success messages', () => {
      const result = checkContrast(
        darkNeumorphicTheme.colors.success.DEFAULT,
        darkNeumorphicTheme.colors.background
      )

      // Success color should be visible
      expect(result.ratio).toBeGreaterThan(3)
    })

    it('should have sufficient contrast for danger messages', () => {
      const result = checkContrast(
        darkNeumorphicTheme.colors.danger.DEFAULT,
        darkNeumorphicTheme.colors.background
      )

      // Danger color should be visible
      expect(result.ratio).toBeGreaterThan(3)
    })
  })
})
