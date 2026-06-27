# App Design Guide

This App-only guide maps the Camera SN design language to the public mobile scanning workflow. It removes management and admin-console sections while preserving the shared visual tokens already implemented in `src/shared/styles/theme.css`.

## Design Tone

Camera SN App is a field utility. The interface should be calm, dense enough for repetitive scanning work, and clear under data-center lighting conditions.

- Favor neutral surfaces over decorative color.
- Use color only for status, destructive actions, or scanner feedback that must be noticed quickly.
- Keep one primary action per screen.
- Prefer direct labels and inline validation over hidden helper text.

## Color Tokens

Use semantic CSS variables and Tailwind token aliases, never hard-coded hex or RGB values.

| Token | Light value | Use |
| --- | --- | --- |
| `--background` | `oklch(1 0 0)` | App surface |
| `--foreground` | `oklch(0.129 0.042 264.695)` | Primary text |
| `--card` | `oklch(1 0 0)` | Cards and sheets |
| `--primary` | `oklch(0.208 0.042 265.755)` | Primary action, selected state |
| `--primary-foreground` | `oklch(0.984 0.003 247.858)` | Text on primary |
| `--secondary` | `oklch(0.968 0.007 247.896)` | Secondary controls |
| `--muted` | `oklch(0.968 0.007 247.896)` | Subtle backgrounds |
| `--muted-foreground` | `oklch(0.554 0.046 257.417)` | Helper text |
| `--accent` | `oklch(0.968 0.007 247.896)` | Hover and pressed highlights |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Delete, reject, conflict, irreversible actions |
| `--border` | `oklch(0.929 0.013 255.508)` | Dividers and card borders |
| `--input` | `oklch(0.929 0.013 255.508)` | Field borders |
| `--ring` | `oklch(0.704 0.04 256.788)` | Keyboard focus ring |

Dark mode uses the `.dark` mappings in `theme.css`: deep rock-blue backgrounds, near-white foregrounds, muted dark secondary surfaces, translucent borders, and a softer destructive token.

## Typography

- UI text: `Inter` with system fallback.
- Display headings: `Manrope` when a larger empty or onboarding state needs extra hierarchy.
- Native fallback: system fonts are acceptable for mobile shells when web fonts are not loaded.
- Inputs must remain at least 16px on narrow screens to prevent mobile focus zoom.

## Radius and Spacing

- Base radius: `--radius = 0.625rem`.
- Derived radii: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`.
- Buttons, inputs, and badges use small or medium radii.
- Cards, dialogs, and sheets use large or extra-large radii.
- Spacing follows a regular scale through Tailwind spacing and `gap-*` utilities; do not add empty elements for spacing.

## Mobile Layout

- Design mobile-first and verify at 320px width without horizontal scrolling.
- Touch targets should be at least 44px in both dimensions.
- Prefer a single-column content flow for scan, submit, and profile screens.
- Long explanatory text should stay constrained and should not span the full viewport on wide screens.
- Use Flex or Grid with gaps instead of deep wrapper nesting.

## Component Guidance

### Buttons

Use one visually dominant primary button per screen for actions such as creating a batch, starting scan, submitting, or exporting. Secondary actions use `secondary`, `outline`, `ghost`, or link-like treatments.

### Cards and Lists

Cards are top-level information containers. Do not nest bordered or shadowed cards inside another card. For scan items, use list rows, separators, grouped headings, or collapsible sections instead.

### Forms

Fields must have labels. Validation errors should appear next to the relevant field and should not rely only on toast notifications. Focus state uses the ring token.

### Scanner Feedback

Scanner success, duplicate SN, invalid U position, and submission result states must use text plus color or iconography. Do not communicate status by color alone.

### Loading and Offline States

Show skeletons or stable placeholders when loading exceeds 300ms. Offline or locally pending states should use neutral/muted styling unless user action is required.

## Accessibility Baseline

- All interactive elements must be keyboard reachable.
- Focus order should match the visual order.
- Icon-only controls require accessible labels.
- Text/background contrast should meet WCAG AA: 4.5:1 for body text and 3:1 for large text.
- Dynamic updates such as scan success should be announced through visible text and appropriate live-region behavior when practical.
