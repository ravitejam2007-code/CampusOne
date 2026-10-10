# CampusOne — Project Memory & Context

## Project Overview
- **Project Name:** CampusOne (Student Organization Management System)
- **Context:** Odoo × NMIT 2026 Hackathon
- **Goal:** One unified platform running events, members, and money for student organizations (Skyline Student Association).
- **Core Stack:** Astro 5+ (SSR), Tailwind CSS v4 (`@tailwindcss/vite`), TypeScript, React islands, Supabase BaaS (PostgreSQL, Auth, RLS, Storage, Edge Functions, `pg_cron`), Razorpay Checkout (Test Mode).
- **Frontend Design System:** Meta-inspired design language canonicalized in `docs/CampusOne Design.md` (derived from `docs/DESIGN-meta (1).md`) featuring stark white canvas, confident product-merchandising typography (Google Font Montserrat with geometric OpenType features ss01/ss02), dual-CTA hero patterns (black primary + outlined secondary), cobalt blue (`#0064E0`) strictly reserved for in-product purchase/checkout CTAs, and signature pill-shaped (`rounded-full` 100px) buttons and chips.
- **Active Agent Skills:** `astro-framework` / `astro` (Astro 5+ architecture & routing), `frontend-design` (distinctive UI art direction), `tailwind-4-docs` (Tailwind CSS v4 @theme directives), `tailwind-v4-shadcn` (CSS variable & component patterns), `tailwindcss-animations` (Tailwind CSS keyframe animations), `supabase` (backend integrations).

## Challenge Coverage (6 Scenes from Hackathon PDF)
1. **New Student Joins:** Walk-up / self-service signup, membership tiers, dues payment, renewal reminders, door lookup.
2. **Spring Gala Tickets:** Online tickets, member vs non-member pricing, seat limits, instant door QR check-in, attendance & revenue summary.
3. **Announcements & Meetings:** Public/member announcement feed, mailing list preferences and opt-out.
4. **Club Hoodies & Merch:** Product variants (sizes/colors), atomic stock reservations, member discounts, order tracking.
5. **Fundraiser Planning:** Bake sale task board (owners/status/due dates), goal vs raised progress card, cash contribution ledger entry.
6. **Treasurer Overview:** Real-time money in, money out, net recorded movement, source breakdown, immutable audited ledger.

## Phase Progress
- [x] **Project Inception & Requirements Analysis:** Analyzed `Student_Organization_System.pdf`, `CampusOne_Hackathon_Architecture_Plan (3).md`, and `DESIGN-meta (1).md`.
- [x] **Phase 0: Design System & Frontend Foundation:**
  - Standardized canonical design system into `docs/CampusOne Design.md` with full token contracts.
  - Created root monorepo workspace (`package.json`, `pnpm-workspace.yaml`).
  - Scaffolded `apps/web` with Astro 5+, `@tailwindcss/vite`, Tailwind CSS v4, React islands, and Google Font Montserrat.
  - Implemented Tailwind v4 `@theme` tokens in `apps/web/src/styles/global.css` (colors, typography, radii, elevation).
  - Built core UI primitives (`Button`, `Card`, `Badge`, `Input`, `SearchPill`, `PromoBanner`, `Navbar`, `Footer`).
  - Scaffolded all 6 scene routes (`/`, `/memberships`, `/events`, `/announcements`, `/merch`, `/fundraiser`, `/treasurer`).
  - Cleaned all developer commentary, technical stack references, and hackathon meta-labels ("Scene X", "Test Mode", "BaaS Architecture", "Built on...") across all pages for a pure, authentic student organization product experience.
  - Created `AGENTS.md` with guidelines and skill installation recipes.
  - Validated with 0 errors via `astro check` and `astro build` (7 production scene pages built).

- [x] **Phase 1: Shared Foundation & Money Model:**
  - Configured Supabase MCP server (`https://mcp.supabase.com/mcp?project_ref=leifxoxnqnvezbmdtmcr...`) in `~/.gemini/antigravity/mcp_config.json`, `~/.gemini/antigravity-ide/mcp_config.json`, and `~/.gemini/config/mcp_config.json`.
  - Installed official Supabase agent skills (`supabase`, `supabase-postgres-best-practices`).
  - Created initial database migration `supabase/migrations/20261010000001_phase1_initial_schema.sql` spanning 29 P0 tables with UUID primary keys, check constraints, foreign keys, performance indexes, and strict Row Level Security (RLS) policies.
  - Implemented transactional PostgreSQL RPCs in `supabase/migrations/20261010000002_phase1_rpcs.sql`:
    * `create_checkout`: Atomic capacity/stock reservation, server-authoritative discount calculation, idempotency.
    * `fulfill_checkout`: Idempotent fulfilment, ticket issuance with deterministic QR HMAC, stock finalization, membership activation, source-linked immutable ledger posting.
    * `record_staff_payment`: Audited staff recording for cash and manual UPI payments.
    * `record_cash_contribution`: Audited bake sale cash income recording and real-time fundraiser total update.
    * `check_in_ticket`: Atomic door check-in with duplicate scan prevention.
    * `get_treasurer_overview`: Financial balance and breakdown aggregation from ledger entries.
    * `refresh_action_queue`: Deterministic evaluation of operational rules (renewals, capacity, tasks, stock).
  - Seeded canonical demo records in `supabase/migrations/20261010000003_phase1_seed_data.sql` for "CampusOne Demo Club", membership tiers, Spring Gala 2026, merchandise variants, announcements, fundraiser, and action queue rules.
  - Built `@campusone/contracts` package in monorepo (`packages/contracts`) with shared TypeScript types and RPC contracts.
  - Created client and SSR integration layer in `apps/web/src/lib/` (`supabase.ts`, `auth.ts`, `api.ts`, `formatters.ts`).
  - Implemented and verified automated test suite in `packages/contracts/src/phase1.test.ts` with 9 passing tests covering role-permission matrix, discount arithmetic, capacity limits, and ledger balancing.
  - Confirmed 0 errors on production Astro build (`astro build` -> 7 scene routes generated).
  - Fixed GitHub Actions CI workflow (`.github/workflows/ci.yml`): eliminated invalid `node-modules-cache` parameter, specified Node.js 22 LTS, pinned `ubuntu-24.04` runner, and integrated automated test step (`pnpm test`).
  - Executed `supabase db push` against remote Supabase project `leifxoxnqnvezbmdtmcr` (CampusOne - Odoo X NMIT 2026), successfully applying migrations 1, 2, and 3 (`20261010000001_phase1_initial_schema.sql`, `20261010000002_phase1_rpcs.sql`, `20261010000003_phase1_seed_data.sql`). Verified via `supabase migration list`.

- [x] **Phase 3: Payment and Scheduled Jobs (Razorpay & pg_cron):**
  - **Razorpay Test Mode Order Creation:** Built `create-payment-order` Deno Edge Function (`supabase/functions/create-payment-order/index.ts`) creating Razorpay orders via API with test key `rzp_test_TXWbmmg3SRSwlV`, validating authoritative database totals, and saving `razorpay_order_id`.
  - **HMAC Signature Verification:** Built `verify-payment` Deno Edge Function (`supabase/functions/verify-payment/index.ts`) performing Web Crypto HMAC-SHA256 verification over `${razorpay_order_id}|${razorpay_payment_id}` using `RAZORPAY_KEY_SECRET` and calling `fulfill_checkout` RPC.
  - **Raw-Body Webhook Verification:** Built `razorpay-webhook` Deno Edge Function (`supabase/functions/razorpay-webhook/index.ts`) with Deno `--no-verify-jwt`, reading raw body via `req.text()`, verifying `X-Razorpay-Signature` HMAC-SHA256, and handling `payment.captured`/`order.paid` events idempotently.
  - **Staff Payment Path:** Built `record-manual-payment` Deno Edge Function (`supabase/functions/record-manual-payment/index.ts`) with staff role enforcement (`is_org_staff`) for cash and manual UPI payments via `record_staff_payment` RPC.
  - **pg_cron Scheduled Jobs Migration:** Created `supabase/migrations/20261010000004_phase3_scheduled_jobs.sql`:
    * `generate_membership_expiry_reminders()`: Scans active memberships expiring within 30d and 7d, inserts into `membership_reminders` and `action_queue_items` with dedupe keys (`0 8 * * *`).
    * `expire_stale_checkouts()`: Cancels checkouts in `pending_payment` past `expires_at` and atomically releases reserved event capacity (`events.reserved_capacity`) and merch stock (`product_variants.reserved_quantity`) (`*/15 * * * *`).
  - **CORS & Role Check Standard:** Created unified Deno CORS helper (`_shared/cors.ts`) supporting preflight OPTIONS and header checks.
  - **Contracts & Automated Test Suite:** Updated `@campusone/contracts` and added `packages/contracts/src/phase3.test.ts` (Razorpay HMAC calculation, raw webhook signature verification, single ledger posting invariants, renewal reminder windows, reservation release equations, CORS header compliance).

## Key Design Rules & Conventions

- **Cobalt Rule:** `#0064E0` is strictly reserved for buy-now / checkout flows (`Add to cart`, `Buy Tickets`, `Pay Dues`). Marketing and general CTAs use black pill buttons (`#000000`).
- **Pill Shape Rule:** Buttons, badges, search bars, category tabs are ALWAYS `rounded-full` (100px). No square buttons.
- **Card Rounding:** Feature cards use `rounded-3xl` (32px), utility/icon cards use `rounded-xl` (16px).
- **Elevation:** Flat design baseline; subtle shadow only for sticky purchase rails and active tabs.
- **Integrity Rule:** No fabricated numbers or mock totals; all stats link to real persisted records.

