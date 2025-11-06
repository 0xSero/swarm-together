# Brand Kit & Theming Guide

## Overview

Swarm Together uses a **Dark Neumorphic** design system that provides depth through soft shadows while maintaining a modern, accessible dark interface.

## Design Tokens

### Colors

#### Base Layers
- `background` (#0B0F14) - Main app background
- `surface` (#11161C) - Card and panel backgrounds
- `elevated` (#151B23) - Elevated elements (dialogs, menus)
- `overlay` (#1A2029) - Modal overlays

#### Brand Colors
Each brand color has three variants: DEFAULT, dark, light

- `primary` - #5B9BFF (Blue) - Primary actions, links
- `secondary` - #8B7CFF (Purple) - Secondary actions
- `accent` - #3CE2B3 (Teal) - Highlights, accents

#### Semantic Colors
- `success` - #33D69F (Green) - Success states
- `warning` - #FFB020 (Orange) - Warning states
- `danger` - #FF6B6B (Red) - Error/danger states
- `info` - #5B9BFF (Blue) - Informational messages

#### Text Hierarchy
- `text-high` (#E6EDF3) - Primary text, headings
- `text-medium` (#C5D1DC) - Secondary text
- `text-low` (#98A6B3) - Tertiary text
- `text-muted` (#7D8A96) - Disabled/muted text

#### Borders
- `border` (#27303B) - Standard borders
- `border-light` (#3A4554) - Lighter borders
- `border-dark` (#1A2029) - Darker borders

### Typography

#### Font Families
- **Sans**: Inter, system-ui, -apple-system, sans-serif
- **Mono**: JetBrains Mono, Fira Code, Consolas, monospace

#### Font Sizes
- `xs`: 0.75rem (12px)
- `sm`: 0.875rem (14px)
- `base`: 1rem (16px)
- `lg`: 1.125rem (18px)
- `xl`: 1.25rem (20px)
- `2xl`: 1.5rem (24px)
- `3xl`: 1.875rem (30px)
- `4xl`: 2.25rem (36px)

#### Font Weights
- `normal`: 400
- `medium`: 500
- `semibold`: 600
- `bold`: 700

### Spacing
- `xs`: 0.25rem (4px)
- `sm`: 0.5rem (8px)
- `md`: 1rem (16px)
- `lg`: 1.5rem (24px)
- `xl`: 2rem (32px)
- `2xl`: 3rem (48px)

### Border Radius
- `sm`: 8px - Small elements
- `DEFAULT`: 10px - Standard elements
- `md`: 12px - Medium cards
- `lg`: 16px - Large cards
- `xl`: 20px - Extra large panels
- `2xl`: 24px - Hero sections
- `full`: 9999px - Pills, avatars

## Neumorphic Shadows

### Standard Shadows
Apply depth to elements:

```tsx
// Small shadow - buttons, chips
className="shadow-neu-sm"

// Medium shadow - cards, panels
className="shadow-neu-md"

// Large shadow - modals, popovers
className="shadow-neu-lg"

// Extra large shadow - hero sections
className="shadow-neu-xl"
```

### Inset Shadows
For pressed states and input fields:

```tsx
// Input fields, pressed buttons
className="shadow-neu-inset"
```

### Glow Effects
For hover states and focus:

```tsx
// Primary glow - blue
className="hover:shadow-glow-primary"

// Success glow - green
className="hover:shadow-glow-success"

// Warning glow - orange
className="hover:shadow-glow-warning"

// Danger glow - red
className="hover:shadow-glow-danger"
```

## Component Patterns

### Buttons

```tsx
// Primary button
<button className="px-4 py-2 rounded-md bg-primary text-white shadow-neu-md hover:shadow-neu-lg active:shadow-neu-inset transition-all">
  Primary Action
</button>

// Secondary button
<button className="px-4 py-2 rounded-md bg-surface text-text-high border border-border shadow-neu-md hover:shadow-neu-lg">
  Secondary Action
</button>

// Danger button
<button className="px-4 py-2 rounded-md bg-danger text-white shadow-neu-md hover:shadow-glow-danger">
  Danger Action
</button>
```

### Cards

```tsx
// Standard card
<div className="p-6 rounded-lg bg-surface shadow-neu-md border border-border">
  <h3 className="text-lg font-semibold text-text-high mb-2">Card Title</h3>
  <p className="text-text-medium">Card content</p>
</div>

// Elevated card
<div className="p-6 rounded-lg bg-elevated shadow-neu-lg border border-border-light">
  <h3 className="text-lg font-semibold text-text-high mb-2">Elevated Card</h3>
  <p className="text-text-medium">Higher elevation</p>
</div>
```

### Input Fields

```tsx
// Text input
<input
  type="text"
  className="px-3 py-2 bg-background border border-border rounded-md shadow-neu-inset text-text-high placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:shadow-glow-primary"
  placeholder="Enter text..."
/>

// Textarea
<textarea
  className="px-3 py-2 bg-background border border-border rounded-md shadow-neu-inset text-text-high placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
  placeholder="Enter text..."
  rows={4}
/>
```

### Semantic Messages

```tsx
// Success message
<div className="p-3 rounded-md bg-success/10 border border-success/20">
  <p className="text-success font-medium">Operation successful!</p>
</div>

// Warning message
<div className="p-3 rounded-md bg-warning/10 border border-warning/20">
  <p className="text-warning font-medium">Warning: Check this</p>
</div>

// Error message
<div className="p-3 rounded-md bg-danger/10 border border-danger/20">
  <p className="text-danger font-medium">Error occurred</p>
</div>
```

## Using the Theme Provider

### Basic Usage

```tsx
import { ThemeProvider } from '@/providers/ThemeProvider'

function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  )
}
```

### Accessing Theme

```tsx
import { useTheme } from '@/providers/ThemeProvider'

function MyComponent() {
  const { theme, overrideToken } = useTheme()

  return (
    <div>
      <p style={{ color: theme.colors.primary.DEFAULT }}>
        Primary text
      </p>
    </div>
  )
}
```

### Runtime Token Overrides

```tsx
import { useTheme } from '@/providers/ThemeProvider'

function ThemeCustomizer() {
  const { overrideToken, resetOverrides } = useTheme()

  const handleColorChange = (color: string) => {
    overrideToken('colors.primary.DEFAULT', color)
  }

  return (
    <div>
      <input type="color" onChange={(e) => handleColorChange(e.target.value)} />
      <button onClick={resetOverrides}>Reset</button>
    </div>
  )
}
```

## Utility Functions

### Neumorphic Button Helper

```tsx
import { neuButton } from '@/providers/ThemeProvider'

<button className={neuButton('primary')}>Primary</button>
<button className={neuButton('secondary')}>Secondary</button>
<button className={neuButton('danger')}>Danger</button>
```

### Neumorphic Card Helper

```tsx
import { neuCard } from '@/providers/ThemeProvider'

<div className={neuCard()}>Standard card</div>
<div className={neuCard(true)}>Elevated card</div>
```

### Neumorphic Input Helper

```tsx
import { neuInput } from '@/providers/ThemeProvider'

<input type="text" className={neuInput()} />
```

## Accessibility

### Contrast Checking

All color combinations are validated against WCAG 2.1 standards:

```tsx
import { checkContrast, WCAGLevel } from '@/types/theme'

const result = checkContrast('#E6EDF3', '#0B0F14')
console.log(`Contrast: ${result.ratio}:1 (${result.level})`)
// Output: Contrast: 14.5:1 (AAA)
```

### Theme Validation

```tsx
import { validateThemeContrast, darkNeumorphicTheme } from '@/types/theme'

const results = validateThemeContrast(darkNeumorphicTheme)
results.forEach(r => {
  console.log(`${r.pair}: ${r.ratio}:1 - ${r.passes ? 'PASS' : 'FAIL'}`)
})
```

### Guidelines

1. **Text Contrast**: All text must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
2. **Interactive Elements**: Buttons and links should have sufficient contrast and visible focus states
3. **Color Independence**: Don't rely solely on color to convey information
4. **Focus Indicators**: All interactive elements must have visible focus states

## Animation

### Durations
- `fast`: 150ms - Small state changes
- `normal`: 300ms - Standard transitions
- `slow`: 500ms - Complex animations

### Easing
- `linear` - Constant speed
- `in` - Accelerate (cubic-bezier(0.4, 0, 1, 1))
- `out` - Decelerate (cubic-bezier(0, 0, 0.2, 1))
- `inOut` - Accelerate then decelerate (cubic-bezier(0.4, 0, 0.2, 1))

### Usage

```tsx
// Standard transition
className="transition-all duration-normal ease-out"

// Hover animation
className="hover:scale-105 transition-transform duration-fast"

// Fade in
className="animate-fade-in"
```

## Best Practices

1. **Consistency**: Use design tokens instead of hard-coded values
2. **Hierarchy**: Use text hierarchy (high > medium > low > muted) to establish importance
3. **Spacing**: Maintain consistent spacing using spacing tokens
4. **Depth**: Use neumorphic shadows to create depth and hierarchy
5. **Accessibility**: Always validate contrast ratios
6. **Performance**: Use CSS variables for theme tokens to enable runtime switching

## Examples

See `e2e/theme-visual.spec.ts` for visual regression tests showing correct usage of all theme elements.
