---
name: Playa Privada
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4d4635'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#7f7663'
  outline-variant: '#d0c5af'
  surface-tint: '#745b00'
  primary: '#745b00'
  on-primary: '#ffffff'
  primary-container: '#f2ca50'
  on-primary-container: '#6b5500'
  inverse-primary: '#eac249'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#006e2d'
  on-tertiary: '#ffffff'
  tertiary-container: '#6ae785'
  on-tertiary-container: '#00662a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe08a'
  primary-fixed-dim: '#eac249'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574400'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
  metric-xl:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  gutter-lg: 1.5rem
  margin: 1.25rem
  margin-mobile: 1rem
  margin-tablet: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

This design system embodies the understated prestige of an exclusive Atlantic beach club (*balneario*) in Mar del Plata. The atmosphere balances coastal leisure with executive operational precision: crisp sea air, bleached architecture, polished brass, and seamless hospitality.

### Design Movement: Quiet Luxury & Modern Flat
The visual identity relies on strict editorial restraint, zero faux-depth ornamentation, and flawless compositional balance:
- **Strictly Flat Architecture:** Zero drop shadows, zero colored glows, and zero skeuomorphic gradients. Depth is established purely through crisp architectural boundaries and subtle shifts between pure white and warm off-white canvases.
- **Fintech Operational Rigor:** High-density operational data (carpas, sombrillas, member accounts, day-pass transactions) structured with the precision of a private banking interface.
- **Generous Spatial Breathing Room (*Mucho Aire*):** Wide gutters, generous internal container padding, and high typographic contrast ensure that even data-dense CRM views feel relaxed, legible, and distinctly premium under direct seaside sunlight.

## Colors

The color system is distilled to essential seaside and architectural tones, calibrated for pristine legibility on mobile displays under bright outdoor conditions.

### Palette Architecture
- **Base Canvas (`#FFFFFF`):** Pure white background establishing clarity, high reflectance, and open space.
- **Subtle Surface (`#F9F9F9`):** Soft off-white reserved for secondary cards, table rows, and alternating data modules.
- **Structural Dividing Line (`#E5E5E5`):** Razor-thin 1px outlines that frame interactive modules without visual noise.
- **Primary Accent (`#F2CA50`):** Warm coastal sand and polished brass. Used intentionally for active selections, badges, highlights, and primary key interactions.
- **Typography Matrix:**
  - *Primary Deep Black (`#000000`):* High-contrast editorial titles, metric counters, and critical labels.
  - *Secondary Slate (`#666666`):* Informational body copy, timestamps, and column descriptors.
  - *Muted Neutral (`#999999`):* Placeholder text, empty state glyphs, and inactive indicators.
- **Functional Semantics:**
  - *Success (`#16A34A`):* Confirmed reservations, cleared payments, available units.
  - *Warning (`#D97706`):* Low availability, pending check-ins, wind alerts.
  - *Error (`#DC2626`):* Overdue balances, cancellations, critical alerts.

## Typography

The type system is powered entirely by Inter. It achieves quiet luxury through meticulous tracking, sharp contrast ratios, and deliberate sizing differences between data metrics and secondary labels.

- **Uppercase Tracking:** Eyebrows, status badges, and metadata labels use `label-md` or `label-lg` transformed to uppercase with expanded letter-spacing (`+0.04em` to `+0.06em`).
- **Metric Prominence:** Monetary amounts, temperature readouts, and carpa unit identifiers leverage `metric-xl` or `display-lg` with tight tracking (`-0.03em`) to mimic private wealth application dashboards.
- **Editorial Hierarchy:** Strict avoidance of mid-tone weights; headings stick to `600` (SemiBold), body text remains at `400` (Regular), and interactive navigation controls utilize `500` (Medium).

## Layout & Spacing

The layout is built on an adaptive fluid grid with generous margins to honor the "mucho aire" philosophy, preventing the CRM from feeling claustrophobic on mobile devices.

### Grid Rhythm & Device Adaptation
- **Mobile Handheld (360px - 599px):**
  - Single primary column layout with contextual 2-column or 4-column subgrids for quick-action icons and KPI stat tiles.
  - Outer screen margin: `margin-mobile` (`1rem` / `16px`).
  - Gutter between adjacent dashboard cards: `gutter` (`1rem` / `16px`).
- **Tablet / Operational iPad (600px - 1024px):**
  - Two-column operational layout (e.g., Carpas interactive beach map on the left, Member folio & reservation details panel on the right).
  - Outer canvas margin: `margin-tablet` (`2rem` / `32px`).
  - Gutter: `gutter-lg` (`1.5rem` / `24px`).

### Vertical Rhythm
Components separate content sections using clean `space-lg` (`24px`) or `space-xl` (`36px`) vertical spacing intervals without decorative horizontal separators, letting empty white space do the work of boundary definition.

## Elevation & Depth

This design system adheres to an absolute **zero-shadow discipline**. No drop shadows, elevation blurs, or colored underglows are permitted anywhere in the interface.

### Depth by Containment & Contrast
Visual hierarchy and separation are established through two precise techniques:
1. **Low-Contrast Structural Outlines:** Every card, container, action sheet, and modal uses a crisp, uniform `1px solid #E5E5E5` border.
2. **Tonal Planar Shifts:**
   - Base app viewport is rendered in `#FFFFFF`.
   - Secondary groups, stat badges, and data strips use `#F9F9F9` fill against the white background.
   - When an interactive card is tapped or active, its surface briefly transitions to `#F9F9F9` with a `#F2CA50` border stroke.
3. **Modals & Drawers:** Overlaid sheets use an unblurred 40% `#000000` scrim with an opaque `#FFFFFF` surface container outlined with a `1px solid #E5E5E5` top edge.

## Shapes

The design system embraces an architectural curvature that softens high-density CRM tables while preserving a structured, modern posture.

- **Primary Outer Cards & Modals:** Standardized on `rounded-2xl` (`1.5rem` / `24px`) for high-level module grouping (KPI cards, Member Folio, Weather Widget).
- **Secondary Containers & Data Cells:** Standardized on `rounded-xl` (`1rem` / `16px`) for sub-items such as reservation rows, action buttons, and input fields.
- **Pills & Status Indicators:** Status tags, weather badges, and chip filters employ a full pill profile (`9999px`) to contrast against rectangular card layouts.

## Components

### Buttons
- **Primary:** Background `#000000`, text `#FFFFFF`, 14px SemiBold, height 48px, `rounded-xl`. No shadow. Active state dims to `#222222`.
- **Secondary / Accent:** Background `#F2CA50`, text `#000000`, 14px SemiBold, height 48px, `rounded-xl`.
- **Ghost / Outlined:** Background `#FFFFFF`, text `#000000`, 1px border `#E5E5E5`, height 48px, `rounded-xl`. Active state applies `#F9F9F9` background.

### Cards & Stat Widgets (Fintech Style)
- **KPI Stat Card:** `#FFFFFF` background, 1px `#E5E5E5` border, `rounded-2xl`, padded with `space-lg`. Houses an uppercase tracking label (`label-md`, `#666666`), followed by a bold numerical value (`metric-xl`, `#000000`), with an inline trend pill (`+14%` in `#16A34A` on `#F9F9F9`).
- **Interactive Carpa/Unit Card:** Border 1px `#E5E5E5`, `rounded-xl`, internal layout displaying unit number (`headline-sm`), customer name (`body-md`), and availability tag.

### Chips & Filter Badges
- **Inactive:** `#F9F9F9` background, 1px `#E5E5E5` border, text `#666666`, `rounded-full`, 32px height, horizontal padding `12px`.
- **Active:** `#000000` background, border `#000000`, text `#FFFFFF`.
- **Highlight (e.g. VIP Member):** `#F2CA50` background, border `#F2CA50`, text `#000000`.

### Form Inputs & Selectors
- **Input Fields:** `#FFFFFF` fill, 1px `#E5E5E5` border, `rounded-xl`, height 48px, padding `0 16px`. Text is `#000000`, placeholder `#999999`. Focused state shifts border to 1.5px `#000000` (or `#F2CA50` for luxury reservations), with zero focus glow ring.

### Lists & Transaction-Style Activity Feed
- Modeled after premium fintech activity screens.
- Borderless rows separated by 1px `#E5E5E5` bottom rules, or grouped within an enclosed `rounded-2xl` card.
- Leading: 40px rounded-xl `#F9F9F9` icon avatar.
- Center: Member name or unit identifier in `title-md`, subtitle in `body-sm` (`#666666`).
- Trailing: Monetary amount or check-in timestamp in `title-md` (`#000000`), status pill underneath.

### Checkboxes & Radio Elements
- **Checkbox:** Square 20x20px with 4px border radius. 1px `#E5E5E5` border when unchecked. Solid `#000000` fill with a crisp white tick when checked.
- **Radio:** 20x20px circle with 1px `#E5E5E5` border. Selected state features an interior `#000000` solid dot (8px).

### Specialty Coastal Components
- **Weather & Wind Badge:** Compact floating or embedded pill at app header. `#F9F9F9` fill, 1px `#E5E5E5` border, combining live Mar del Plata wind knots, water temp, and sky icon in `#000000`.
- **Bottom Navigation Bar:** Fixed to mobile bottom. Solid `#FFFFFF` background, 1px top border `#E5E5E5`, zero shadow. 4 to 5 icons with 10px labels. Active route highlighted with a subtle `#F2CA50` 3px accent line directly beneath the active icon.
- **Quick Action Bar:** Horizontal row of 4 circular or `rounded-xl` action nodes (Check-in, Cobrar, Nueva Carpa, Toallas) utilizing `#F9F9F9` backgrounds and `#000000` iconography.