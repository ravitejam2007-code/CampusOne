---
version: 1.0.0
name: CampusOne Design System
description: CampusOne design system adapted from Meta's hardware commerce & product surfaces. The system pairs a stark white canvas with full-bleed photographic cards, a confident geometric wordmark/headline face (Google Font Montserrat with ss01/ss02 features and Optimistic VF metrics), dual-CTA hero patterns (black primary + outlined secondary), and a saturated cobalt blue (#0064E0) strictly reserved for in-product purchase/checkout actions. Signature pill-shaped 100px-radius buttons, generous 24-32px card rounding, and tight three-tier text hierarchy carry across all public and authenticated surfaces.

colors:
  primary: "#0064e0"          # Reserved exclusively for buy-now, ticket checkout, dues payment
  primary-deep: "#0457cb"     # Active/pressed state for cobalt primary
  primary-soft: "#0091ff"     # Translucent tint for informational callouts
  on-primary: "#ffffff"
  ink-button: "#000000"       # Marketing & general primary CTA pill
  on-ink-button: "#ffffff"
  fb-blue: "#1876f2"          # Form focus outline, active radio/checkbox
  meta-link: "#385898"        # Navigation and text link affordances
  oculus-purple: "#a121ce"    # Special category/accent highlighting
  success: "#31a24c"          # Affirmative status (In stock, verified, active)
  success-bg: "#24e400"
  attention: "#f2a918"        # Mid-priority status (Almost gone, pending review)
  warning: "#f7b928"          # Promotional banners, limited-time notices
  warning-bg: "#ffe200"
  critical: "#e41e3f"         # Urgent/destructive status (Out of stock, rejected)
  critical-strong: "#f0284a"  # Input error borders and alerts
  canvas: "#ffffff"           # Page background & primary card surface
  surface-soft: "#f1f4f7"     # Subtle card background & search pill rest state
  ink-deep: "#0a1317"         # Primary headlines and dark banner background
  ink: "#1c1e21"              # Standard body and secondary titles
  charcoal: "#444950"         # Tertiary body and button pressed states
  slate: "#4b4c4f"            # Section headers and supporting copy
  steel: "#5d6c7b"            # Quieter captions, placeholder text, footer links
  stone: "#8595a4"            # Disabled or de-emphasized labels
  hairline: "#ced0d4"         # 1px input and form control borders
  hairline-soft: "#dee3e9"    # Subtle card borders and section dividers
  disabled-text: "#bcc0c4"

typography:
  font-family: "'Montserrat', 'Optimistic VF', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  hero-display:
    fontSize: 64px
    fontWeight: 500
    lineHeight: 1.16
    letterSpacing: 0
    fontFeature: "ss01, ss02"
  display-lg:
    fontSize: 48px
    fontWeight: 500
    lineHeight: 1.17
    letterSpacing: 0
    fontFeature: "ss01, ss02"
  heading-lg:
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.28
    letterSpacing: 0
    fontFeature: "ss01, ss02"
  heading-md:
    fontSize: 28px
    fontWeight: 300           # Editorial subhead in lighter weight
    lineHeight: 1.21
    letterSpacing: 0
    fontFeature: "ss01, ss02"
  heading-sm:
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 0
    fontFeature: "ss01, ss02"
  subtitle-lg:
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.44
  subtitle-md:
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.44
  body-md-bold:
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.50
    letterSpacing: -0.16px
  body-md:
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.16px
  body-sm-bold:
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.43
    letterSpacing: -0.14px
  body-sm:
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: -0.14px
  caption-bold:
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.33
  caption:
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
  button-md:
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.43
    letterSpacing: -0.14px

rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px                     # Form inputs, radio containers
  xl: 16px                    # Icon feature cards, FAQ items
  xxl: 24px                   # Utility tiles
  xxxl: 32px                  # Signature photographic & feature cards
  feature: 40px               # Large hero containers
  full: 100px                 # Buttons, category tabs, badges, search pills
  circle: 9999px              # Swatches and circular icon buttons

spacing:
  xxs: 4px
  xs: 8px
  sm: 10px
  md: 12px
  base: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 40px
  section-sm: 48px
  section: 64px
  section-lg: 80px
  hero: 120px

elevation:
  level-0: "none (border: 1px solid var(--color-hairline-soft))"
  level-1: "rgba(0, 0, 0, 0.2) 1px 1px 0px 0px"
  level-2: "rgba(20, 22, 26, 0.3) 0px 1px 4px 0px" # Sticky purchase rails & active indicators
---

# CampusOne Design System Specification

## 1. System Philosophy & Grounding

CampusOne serves the **Skyline Student Association** across 6 critical operational scenes:
1. Walk-up & online membership onboarding
2. Spring Gala ticket sales & rapid door check-in
3. Announcement broadcast & mailing list preferences
4. Hoodie & merchandise ordering with variant stock tracking
5. Fundraiser bake-sale planning & task management
6. Real-time treasurer financial tracking & source-linked ledger

The design voice is **merchandising-confident, stark, and ultra-crisp**:
- Stark white canvas (`#ffffff`) with hairline dividers (`#dee3e9`).
- Confident display typography anchored by open-source **Montserrat** with `ss01, ss02` stylistic features and negative body letter-spacing (`-0.14px` to `-0.16px`).
- Signature **pill-shaped interactive controls** (`rounded-full` 100px) that make every button and chip unmistakable.
- Dual-CTA hero hierarchy: black primary (`#000000`) for marketing/exploration paired with ghost outlined secondary.
- **Strictly scarce Cobalt Primary (`#0064E0`)**: Reserved exclusively for commerce and checkout moments (`Add to cart`, `Buy Tickets`, `Pay Dues`).

---

## 2. Token Definitions & Variables

### Colors
- **Canvas White** (`#ffffff`): Clean, uncluttered base background.
- **Soft Surface** (`#f1f4f7`): Subtle card fill, product thumbnail backgrounds, and search pill rest state.
- **Ink Deep** (`#0a1317`): High-contrast headline text and dark announcement strip.
- **Ink** (`#1c1e21`): Primary body text.
- **Cobalt Primary** (`#0064e0`): The purchase CTA color. Never used on general marketing buttons.
- **Primary Deep** (`#0457cb`): Pressed and active states for cobalt actions.
- **Ink Button** (`#000000`): Primary button color for marketing and informational pages.
- **Hairline** (`#ced0d4`): Form input borders.
- **Hairline Soft** (`#dee3e9`): Card borders and section dividers.
- **Facebook Blue** (`#1876f2`): Form input active focus rings.
- **Warning Yellow** (`#f7b928`): Promotional chips and demo mode notices.
- **Success Green** (`#31a24c`): Verified status, in-stock pills, check-in success.
- **Critical Red** (`#e41e3f`): Urgent alerts, sold-out status, validation errors.

### Typography Hierarchy
- **`hero-display`** (64px / weight 500 / line-height 1.16): Homepage hero headers.
- **`display-lg`** (48px / weight 500 / line-height 1.17): Scene showcase titles.
- **`heading-lg`** (36px / weight 500 / line-height 1.28): Major section headlines.
- **`heading-md`** (28px / weight 300 / line-height 1.21): Editorial subheads in light weight, providing breathing room.
- **`heading-sm`** (24px / weight 500 / line-height 1.25): Card titles and feature headers.
- **`subtitle-lg`** (18px / weight 700 / line-height 1.44): Bold callouts and FAQ questions.
- **`body-md`** (16px / weight 400 / line-height 1.50 / letter-spacing -0.16px): Primary body copy.
- **`body-sm-bold`** (14px / weight 700 / line-height 1.43 / letter-spacing -0.14px): Pill tabs, button labels, badge text.
- **`caption`** (12px / weight 400 / line-height 1.33): Microcopy, timestamps, table footnotes.

### Radii Scale
- **`rounded-full`** (100px): All buttons, category tabs, badges, search pills. Non-negotiable brand signature.
- **`rounded-3xl`** (32px): Feature cards, showcase hero tiles, promo strips.
- **`rounded-xl`** (16px): Standard feature cards, product thumbnails, checkout panels.
- **`rounded-lg`** (8px): Form input fields, radio option tiles.

---

## 3. Component Architecture & Specs

### Buttons
1. **`button-primary`**: Black pill (`bg-[#000000] text-white rounded-full px-[30px] py-[14px] text-[14px] font-bold tracking-[-0.14px]`). Used for marketing, joining, exploring.
2. **`button-buy-cta`**: Cobalt pill (`bg-[#0064e0] text-white rounded-full px-[30px] py-[14px] text-[14px] font-bold tracking-[-0.14px]`). Strictly for purchasing tickets, merchandise, or dues.
3. **`button-secondary`**: Outlined pill (`bg-transparent text-[#0a1317] border-2 border-[#0a1317] rounded-full px-[28px] py-[12px] text-[14px] font-bold`).
4. **`button-ghost`**: Subtle outlined pill (`bg-transparent text-[#0a1317] border-2 border-black/10 rounded-full px-[22px] py-[10px] text-[14px] font-bold`).
5. **`button-pill-tab`**: Category navigation chip (`bg-white text-[#1c1e21] border border-[#ced0d4] rounded-full px-4 py-2 text-[14px] font-bold`). Active state flips to `bg-[#0a1317] text-white border-transparent`.

### Cards & Surfaces
1. **`card-product-feature`**: White card with 32px corners, 1px `#dee3e9` border, generous 32px padding (`p-8`).
2. **`card-feature-photo`**: Edge-to-edge photography card with 32px corners and overlaid copy.
3. **`card-icon-feature`**: 3-up/4-up reassurance tiles with 16px corners, 1px border, 24px padding (`p-6`).
4. **`card-checkout-summary`**: Sticky right-rail purchase panel with 16px corners, 1px border, and level-2 shadow (`rgba(20, 22, 26, 0.3) 0px 1px 4px`).

### Form Inputs
1. **`text-input`**: 44px height, 8px radius, 1px `#ced0d4` border, 16px font size. Focus state: `2px solid #1876f2`.
2. **`search-pill`**: 40px height, 100px pill radius, `#f1f4f7` surface-soft background, placeholder in `#5d6c7b`.

### Badges & Status Chips
- `badge-promo-yellow`: `#f7b928` bg, `#0a1317` text, 100px pill radius, `px-2.5 py-1 text-xs font-bold`.
- `badge-attention`: `#f2a918` bg, white text.
- `badge-success`: `#31a24c` bg, white text.
- `badge-critical`: `#e41e3f` bg, white text.

---

## 4. Strict Do's and Don'ts

### Do
- Always use `rounded-full` (100px) on every button and navigation tab.
- Reserve `#0064E0` exclusively for checkout and purchase CTAs.
- Use Montserrat with 300 weight for editorial subheads to provide visual rhythm against 500-weight display titles.
- Keep the baseline elevation flat (1px hairline-soft borders) and reserve drop shadows for sticky purchase panels.
- Display the "CampusOne Demo Club" label visibly on test transactions and demo data.

### Don't
- Don't use `#0064E0` on general marketing buttons.
- Don't use rectangular or slightly-rounded (`rounded-md`, `rounded-lg`) buttons.
- Don't add arbitrary gradients, drop shadows, or decorative borders that clutter the stark white canvas.
- Don't hardcode fabricated dashboard numbers; let all UI metrics stem from persisted database records.
