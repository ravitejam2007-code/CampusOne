# AGENTS.md — Agent Skills & Developer Operating Guidelines

Welcome! This repository powers **CampusOne** (Student Organization Management System for Skyline Student Association), developed for the Odoo × NMIT 2026 Hackathon.

All AI coding assistants (Antigravity, Claude, Cursor, Copilot, etc.) working on this repository must follow the architectural constraints, design system rules, and specialized agent skills outlined in this guide.

---

## 1. Installed Agent Skills

The following specialized skills are installed in `.agents/skills/` (and globally in `~/.agents/skills/`) to guide engineering and visual implementation:

| Skill | Source / Package | Purpose |
|---|---|---|
| **`astro-framework`** / **`astro`** | `https://github.com/delineas/astro-framework-agents` / `astrolicious/agent-skills@astro` | Astro 5+ specialist: islands architecture, selective hydration (`client:load`, `client:idle`), server islands (`server:defer`), hybrid rendering, content collections, and `astro.config.mjs` setup. |
| **`frontend-design`** | `https://github.com/anthropics/skills` | Intentional, distinctive UI styling; avoids generic AI-generated templates (no clichéd warm-cream or gradient SaaS cards); ensures cohesive art direction and subject-grounded design. |
| **`tailwind-4-docs`** | `https://github.com/lombiq/tailwind-agent-skills` | Official Tailwind CSS v4 guidance: modern CSS-first `@theme` syntax, custom theme properties, `@import "tailwindcss"` replaces `@tailwind` directives, `@tailwindcss/vite` configuration. |
| **`tailwind-v4-shadcn`** | `https://github.com/secondsky/claude-skills` | Production patterns for Tailwind v4 CSS variable architecture, dark/light theme tokens, and component composition. |
| **`tailwindcss-animations`** | `https://github.com/josiahsiegel/claude-plugin-marketplace` | Tailwind CSS animation and transition recipes, keyframes via `@theme animate`, reduced-motion compliance. |
| **`supabase`** | `supabase/agent-skills@supabase` | Supabase BaaS implementation: Postgres schemas, Row Level Security (RLS) policies, Edge Functions, database RPCs, and Auth. |

---

## 2. Skill Installation & Reinstallation Guide

If working in a fresh environment or container, install the agent skills using the open Skills CLI (`npx skills`):

```bash
# 1. Frontend & Design Skills
npx skills add https://github.com/anthropics/skills --skill frontend-design -g -y
npx skills add https://github.com/lombiq/tailwind-agent-skills --skill tailwind-4-docs -g -y
npx skills add https://github.com/secondsky/claude-skills --skill tailwind-v4-shadcn -g -y
npx skills add https://github.com/josiahsiegel/claude-plugin-marketplace --skill tailwindcss-animations -g -y

# 2. Framework & Architecture Skills
npx skills add https://github.com/delineas/astro-framework-agents --skill astro-framework -g -y
npx skills add astrolicious/agent-skills@astro -g -y
npx skills add supabase/agent-skills@supabase -g -y
```

To search for or update skills:
```bash
npx skills find <keyword>
npx skills update
```

---

## 3. Core Architecture Guidelines

Refer to `docs/CampusOne_Hackathon_Architecture_Plan (3).md` and `docs/CampusOne Design.md` for full specifications:

1. **Stack**: Astro 5+ SSR (`apps/web`), Tailwind CSS v4 via `@tailwindcss/vite`, TypeScript strict mode, React islands (`@astrojs/react`) only when browser interactivity warrants it, Supabase BaaS (Postgres + Auth + RLS + Storage + Edge Functions + `pg_cron`), and Razorpay Checkout (Test Mode).
2. **Authoritative Source of Truth**: Database RLS and server-verified webhooks determine business states (memberships, tickets, inventory, ledger). Frontend routes and hidden buttons are NOT security boundaries.
3. **Demo Data Integrity**: Real persisted database records labelled "CampusOne Demo Club". Never hardcode totals or mock API stats for judges.
4. **Deterministic Action Queue**: Operational tasks are driven by deterministic SQL rules and `pg_cron`, never ungrounded LLM summaries.

---

## 4. Frontend Design System Rules (`docs/CampusOne Design.md`)

When creating or modifying UI components, adhere strictly to these rules:

1. **The Cobalt Rule**: Saturated cobalt blue (`#0064E0` / `var(--color-primary)`) is strictly reserved for in-product purchase / commerce CTAs (`Add to cart`, `Buy Tickets`, `Pay Dues`). Marketing and informational CTAs must use black pill buttons (`#000000` / `var(--color-ink-button)`).
2. **Pill-Shape Signature**: Buttons, category chips, status badges, and search bars MUST use `rounded-full` (100px radius). Buttons are **never** rectangular or slightly rounded.
3. **Typography Stack**: Google Font **Montserrat** (free & open source) with geometric OpenType features (`ss01, ss02`), light weight (`300`) for editorial subheads, medium (`500`) for display headlines, bold (`700`) for buttons/subtitles, and snug negative letter spacing (`-0.14px` to `-0.16px`).
4. **Flat Baseline Elevation**: Default cards use `border: 1px solid var(--color-hairline-soft)` without drop shadows. Subtle shadow (`rgba(20, 22, 26, 0.3) 0px 1px 4px`) is reserved exclusively for sticky purchase/checkout panels and active indicators.
5. **No Hover States in Spec**: Follow clean, high-contrast states with distinct active/pressed feedback.

---

## 5. Further Developer & Agent Assistance

- **Project Status & Memory**: Read and update `MEMORY.md` before and after implementing features.
- **Challenge Coverage**: All 6 scenes from `docs/Student_Organization_System.pdf` are P0 requirements (New Student Joins, Spring Gala Tickets, Announcements, Hoodies & Merch, Fundraiser Bake Sale, Treasurer Overview).
