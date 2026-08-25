---
name: Nocturnal Precision
colors:
  surface: '#0f1418'
  surface-dim: '#0f1418'
  surface-bright: '#343a3e'
  surface-container-lowest: '#090f13'
  surface-container-low: '#171c20'
  surface-container: '#1b2024'
  surface-container-high: '#252b2f'
  surface-container-highest: '#30353a'
  on-surface: '#dee3e9'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#dee3e9'
  inverse-on-surface: '#2c3135'
  outline: '#87929b'
  outline-variant: '#3e4850'
  surface-tint: '#83cfff'
  primary: '#83cfff'
  on-primary: '#00344b'
  primary-container: '#00adef'
  on-primary-container: '#003d57'
  inverse-primary: '#00658d'
  secondary: '#77d1ff'
  on-secondary: '#003549'
  secondary-container: '#00a1d6'
  on-secondary-container: '#003346'
  tertiary: '#ffb86f'
  on-tertiary: '#4a2800'
  tertiary-container: '#e78d18'
  on-tertiary-container: '#553000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c6e7ff'
  primary-fixed-dim: '#83cfff'
  on-primary-fixed: '#001e2e'
  on-primary-fixed-variant: '#004c6c'
  secondary-fixed: '#c2e8ff'
  secondary-fixed-dim: '#77d1ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004d68'
  tertiary-fixed: '#ffdcbe'
  tertiary-fixed-dim: '#ffb86f'
  on-tertiary-fixed: '#2c1600'
  on-tertiary-fixed-variant: '#693c00'
  background: '#0f1418'
  on-background: '#dee3e9'
  surface-variant: '#30353a'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Schibsted Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: '0'
  body-md:
    fontFamily: Schibsted Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  label-md:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  metadata-sm:
    fontFamily: Schibsted Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  touch-target: 48px
  margin-mobile: 16px
  margin-desktop: 32px
  gutter: 16px
  unit-xs: 4px
  unit-sm: 8px
  unit-md: 16px
  unit-lg: 24px
  unit-xl: 32px
---

## Brand & Style
The design system is engineered for deep focus during late-night physics study sessions. It adopts a **Modern-Technical** aesthetic that prioritizes high-legibility and reduced eye strain. The interface is characterized by a "precision-instrument" feel—utilitarian, crisp, and devoid of unnecessary ornamentation. 

The style moves away from traditional elevation shadows, instead utilizing **Tonal Layering** and **Hairline Borders** to define hierarchy. Every element is optimized for the Android-native ecosystem, adhering to strict geometric alignment and generous touch targets to facilitate an efficient learning environment for students in Kerala.

## Colors
This design system operates exclusively in a dark color mode to suit the "deep-night" study narrative. 

- **The Ground (#060814)** serves as the base canvas for the entire application.
- **Signal Cyan (#00ADEF)** is the singular point of focus for primary actions, while **Cyan Lift** is reserved for active states and highlights.
- **Semantic colors** for alerts (Rose and Amber) are desaturated to maintain the calm atmosphere while ensuring visibility.
- **Borders** are critical for separation: use `rgba(255,255,255,0.075)` for subtle separation (Hairline) and `rgba(255,255,255,0.14)` for interactive element perimeters (Edge).

## Typography
The typographic hierarchy is split between **Outfit** for structural and interactive elements (Headings, Buttons, Labels) and **Schibsted Grotesk** for long-form reading (Physics problems, descriptions).

- **Outfit** should be set with tight tracking (negative letter spacing) on large headlines to maintain a compact, technical look.
- **Schibsted Grotesk** is chosen for its open counters and readability under low-light conditions. 
- All labels and buttons should use **Outfit** in Semi-Bold or Bold weight to ensure they are immediately distinguishable from content.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a strictly enforced 8px rhythm. 

- **Touch Targets:** All interactive elements (buttons, checkboxes, list items) must maintain a minimum height/width of 48px to ensure accessibility on mobile devices.
- **Margins:** Standard mobile views use a 16px side margin. On tablet and desktop, this expands to 32px or follows a centered 12-column max-width container (1200px).
- **Physics Formulae:** When displaying equations, ensure a minimum of 24px (unit-lg) vertical padding to separate them from the surrounding explanatory text.

## Elevation & Depth
This design system rejects the use of drop shadows. Depth is communicated strictly through color and borders:

1.  **Level 0 (Background):** Midnight Ground (#060814) for the main app canvas.
2.  **Level 1 (Recessed):** Recessed Night (#090C1D) for search bars or inset areas.
3.  **Level 2 (Surface):** Panel Navy (#0D1128) for the primary content cards and list items.
4.  **Level 3 (Elevated):** Raised Navy (#131836) for modals, menus, and overlays.

All surfaces should be bounded by a **1px Edge border** (`rgba(255,255,255,0.14)`) to ensure they pop against the dark backgrounds.

## Shapes
The shape language is sophisticated and modern, using larger radii for structural containers and tighter radii for internal components.

- **Cards:** All main content containers use a fixed 18px radius.
- **Buttons:** Primary and secondary buttons use a 12px radius.
- **Inputs:** Form fields and search bars use an 8px radius.
- **Pills:** Only use for status chips or specific progress indicators.

## Components
- **Buttons:** Primary buttons use Signal Cyan background with a White or Bright Ice label. Secondary buttons use a transparent background with an Edge border and Signal Cyan text. Touch targets are strictly 48px high.
- **Cards:** Background is Panel Navy (#0D1128). Use a 1px Edge border. Padding should be consistent at 20px or 24px.
- **Input Fields:** Use Recessed Night (#090C1D) with a 1px Hairline border. On focus, the border transitions to Signal Cyan and 1px width (no glow).
- **List Items:** Use a 48px minimum height. Dividers between items should use the Hairline border (`rgba(255,255,255,0.075)`).
- **Progress Bars:** For course completion, use a Signal Cyan fill against a Raised Navy track.
- **Formulas:** Physics equations should be rendered in Bright Ice, centered within a Panel Navy container to distinguish them from prose.