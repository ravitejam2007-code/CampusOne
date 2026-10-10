# CampusOne — Frontend Developer API Connection Guide

Welcome! This guide is written specifically for frontend engineers building or customizing UI components for **CampusOne (Skyline Student Association)**.

The entire backend is live, deployed, and fully verified on Supabase with PostgreSQL Row Level Security (RLS), atomic transactional RPCs, and Deno Edge Functions.

---

## Table of Contents
1. [Environment Setup & Credentials](#1-environment-setup--credentials)
2. [Evaluator Personas & Test Accounts](#2-evaluator-personas--test-accounts)
3. [How to Connect from the Frontend](#3-how-to-connect-from-the-frontend)
4. [Authentication & Session Flow](#4-authentication--session-flow)
5. [Scene 1: New Student Joins & Memberships](#5-scene-1-new-student-joins--memberships)
6. [Scene 2: Spring Gala Tickets & 2-Second Door Check-In](#6-scene-2-spring-gala-tickets--2-second-door-check-in)
7. [Scene 3: Announcements & Communications](#7-scene-3-announcements--communications)
8. [Scene 4: Club Hoodies & Merchandise Store](#8-scene-4-club-hoodies--merchandise-store)
9. [Scene 5: Bake Sale Fundraiser & Volunteer Tasks](#9-scene-5-bake-sale-fundraiser--volunteer-tasks)
10. [Scene 6: Treasurer Financial Overview & Action Queue](#10-scene-6-treasurer-financial-overview--action-queue)
11. [All-in-One Digital Student Pass & QR Generator](#11-all-in-one-digital-student-pass--qr-generator)
12. [Razorpay Payment Gateway & Staff Cash Checkout](#12-razorpay-payment-gateway--staff-cash-checkout)
13. [Standard Error Handling Protocol](#13-standard-error-handling-protocol)
14. [Frontend Design System Rules (Cheat Sheet)](#14-frontend-design-system-rules-cheat-sheet)

---

## 1. Environment Setup & Credentials

In your frontend project (`apps/web` or any React/Next.js/Astro app), configure `.env`:

```env
# Supabase Backend Configuration
PUBLIC_SUPABASE_URL=https://leifxoxnqnvezbmdtmcr.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlaWZ4b3hucW52ZXpibWR0bWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNDMzNzQsImV4cCI6MjA3NTcxOTM3NH0.r20Jm800-47yPj8G4r831H4r52z3_z_x_9

# Razorpay Test Mode Key (for browser checkout modal)
PUBLIC_RAZORPAY_KEY_ID=rzp_test_TXWbmmg3SRSwlV
```

> [!NOTE]
> All sensitive secrets (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) live safely inside the Supabase serverless vault. Frontend clients **never** need or see private keys.

---

## 2. Evaluator Personas & Test Accounts

You can test any role directly using these pre-seeded accounts:

| Role | Email | Password | Allowed Capabilities |
|---|---|---|---|
| **Admin** | `admin@skyline.edu` | `SkylineDemo2026!` | Review membership applications, publish announcements, manage merchandise catalog. |
| **Treasurer** | `treasurer@skyline.edu` | `SkylineDemo2026!` | View Money In/Out KPI tiles, inspect immutable ledger, resolve action queue items. |
| **Door Staff** | `door@skyline.edu` | `SkylineDemo2026!` | Sub-second student search, scan tickets, scan & verify All-in-One passes. |
| **Volunteer** | `volunteer@skyline.edu` | `SkylineDemo2026!` | Drag/update fundraiser tasks, record walk-up bake sale cash donations. |
| **Active Member** | `member@skyline.edu` | `SkylineDemo2026!` | Receive automatic 15% ticket discounts & 10% merch discounts, view passes. |
| **Applicant** | `applicant@skyline.edu` | `SkylineDemo2026!` | Submit and revise membership applications. |

---

## 3. How to Connect from the Frontend

You have two simple ways to connect to the backend:

### Option A: Use the Pre-Built Client SDK (`@campusone/contracts` + `api.ts`)
The repository includes a typed SDK in `apps/web/src/lib/api.ts`:
```typescript
import { api } from '@/lib/api';

// Call any backend method:
const events = await api.getEvents();
const pass = await api.generateAllInOnePass();
```

### Option B: Direct HTTP Fetch or `@supabase/supabase-js`
Every endpoint can be reached with standard browser `fetch`:
```typescript
// RPC call:
const res = await fetch('https://leifxoxnqnvezbmdtmcr.supabase.co/rest/v1/rpc/check_in_ticket', {
  method: 'POST',
  headers: {
    'apikey': process.env.PUBLIC_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${userAccessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ p_ticket_id: ticketId }),
});

// Edge Function call:
const passRes = await fetch('https://leifxoxnqnvezbmdtmcr.supabase.co/functions/v1/generate-all-in-one-pass', {
  method: 'POST',
  headers: {
    'apikey': process.env.PUBLIC_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${userAccessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
});
```

---

## 4. Authentication & Session Flow

### Login (`signInWithPassword`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'member@skyline.edu',
  password: 'SkylineDemo2026!',
});

const userToken = data.session?.access_token; // Pass as Bearer token
```

### Signup (`signUp`)
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'newstudent@skyline.edu',
  password: 'Password123!',
  options: {
    data: {
      full_name: 'Ananya Patel',
      student_id: 'SKY-2026-8910',
    },
  },
});
```

---

## 5. Scene 1: New Student Joins & Memberships

### 5.1 Fetch Membership Tiers
- **Endpoint:** `GET /rest/v1/membership_tiers?is_active=eq.true&order=fee_paise.asc`
- **SDK:** `api.getMembershipTiers()`
- **Response:**
  ```json
  [
    {
      "id": "11111111-1111-1111-1111-111111111101",
      "name": "General Student Member",
      "fee_paise": 25000,
      "duration_days": 365,
      "ticket_discount_percent": 15,
      "merch_discount_percent": 10,
      "benefits": ["15% discount on all campus gala tickets", "10% merchandise discount"]
    }
  ]
  ```

### 5.2 Submit Membership Application
- **Endpoint:** `POST /rest/v1/membership_applications`
- **SDK:** `api.submitMembershipApplication({ tier_id, statement, student_id })`
- **Payload:**
  ```json
  {
    "tier_id": "11111111-1111-1111-1111-111111111101",
    "statement": "Eager to join the robotics chapter."
  }
  ```

### 5.3 Review Application (Admin Only)
- **Endpoint:** `POST /rest/v1/membership_reviews` & `PATCH /rest/v1/membership_applications`
- **SDK:** `api.reviewMembershipApplication({ application_id, decision: 'approved' | 'rejected', notes })`

### 5.4 Door-Side Member Lookup (Sub-second search)
- **SDK:** `api.lookupMember("Rahul")` or search by Student ID (`"SKY-2026-1042"`)
- Returns student profile, membership tier, active/expired status, and discounts.

---

## 6. Scene 2: Spring Gala Tickets & 2-Second Door Check-In

### 6.1 Get Events & Capacity Gauges
- **Endpoint:** `GET /rest/v1/events?status=eq.published&order=starts_at.asc`
- **SDK:** `api.getEvents()`
- Includes: `capacity`, `reserved_capacity`, `sold_count`, `available_tickets: capacity - sold_count - reserved_capacity`.

### 6.2 Buy Event Ticket (Atomic Reservation)
- **SDK:** `api.buyTicket({ ticket_type_id, quantity: 1, is_member: true, attendee_name: 'Rahul' })`
- Automatically applies active member discount (15% off).

### 6.3 Door Scanner: Instant Check-In
- **Endpoint:** `POST /rest/v1/rpc/check_in_ticket`
- **SDK:** `api.checkInTicket({ p_ticket_id: "uuid", p_qr_token: "token" })`
- **Success (200 OK):**
  ```json
  {
    "valid": true,
    "ticket_id": "90cfbc35-...",
    "status": "checked_in",
    "attendee_name": "Rahul Sharma"
  }
  ```
- **Duplicate Scan Protection (409 Conflict):**
  If scanned a second time, throws:
  `"CONFLICT: Ticket already checked in"`

---

## 7. Scene 3: Announcements & Communications

### 7.1 Fetch Announcements Feed
- **Endpoint:** `GET /rest/v1/announcements?order=published_at.desc`
- **SDK:** `api.getAnnouncements(targetAudience?: 'all_members' | 'volunteers' | 'public')`

### 7.2 Publish Announcement (Admin Only)
- **SDK:** `api.publishAnnouncement({ title, content, target_audience, is_pinned })`

### 7.3 Mailing List Preferences
- **SDK:** `api.getMailingPreferences()` / `api.updateMailingPreferences({ newsletter, events, volunteer_callouts, merch_drops })`

---

## 8. Scene 4: Club Hoodies & Merchandise Store

### 8.1 Fetch Products & Variants Grid
- **Endpoint:** `GET /rest/v1/products?select=*,variants:product_variants(*)`
- **SDK:** `api.getProducts()`
- Includes sizes (`S`, `M`, `L`, `XL`), colors, `stock_on_hand`, and `low_stock_warning` (if `stock_on_hand <= 5`).

### 8.2 Order Merchandise Variant
- **SDK:** `api.orderMerchVariant({ variant_id, quantity, shipping_address })`
- Automatically applies 10% active member discount and atomically decrements inventory.

---

## 9. Scene 5: Bake Sale Fundraiser & Volunteer Tasks

### 9.1 Fundraiser Goal & Progress
- **SDK:** `api.getActiveFundraisers()`
- Returns: `goal_paise: 1000000` (₹10,000), `raised_paise: 685000` (₹6,850), and progress percentage.

### 9.2 Kanban Task Board
- **SDK:** `api.getFundraiserTasks(fundraiserId)`
- **Update Status:** `api.updateTaskStatus(taskId, 'in_progress' | 'done')`
- **Create Task:** `api.createTask({ fundraiser_id, title, assignee_name, due_date })`

### 9.3 Record Walk-Up Cash Donation (Volunteers & Treasurer)
- **Endpoint:** `POST /rest/v1/rpc/record_cash_contribution`
- **SDK:** `api.recordCashContribution({ fundraiser_id, amount_paise: 15000, contributor_name: "Alumni", notes: "Brownies purchase" })`
- Atomically updates fundraiser raised total and appends to double-entry ledger.

---

## 10. Scene 6: Treasurer Financial Overview & Action Queue

### 10.1 Financial KPI Tiles
- **Endpoint:** `POST /rest/v1/rpc/get_treasurer_overview`
- **SDK:** `api.getTreasurerOverview()`
- **Response:**
  ```json
  {
    "money_in_paise": 1850000,
    "money_out_paise": 420000,
    "net_balance_paise": 1430000,
    "source_breakdown": {
      "membership": 500000,
      "tickets": 625000,
      "merch": 340000,
      "fundraiser": 385000
    }
  }
  ```

### 10.2 Immutable Double-Entry Ledger
- **Endpoint:** `GET /rest/v1/ledger_entries?order=created_at.desc&limit=50`
- **SDK:** `api.getLedgerEntries()`
- Append-only journal containing transaction timestamps, entry types, categories, amounts, and audit references.

### 10.3 Deterministic Action Queue
- **SDK:** `api.getActionQueueItems()` / `api.refreshActionQueue()` / `api.resolveActionQueueItem(itemId)`
- Surfaces rule-triggered alerts:
  1. Memberships expiring within 30 days
  2. Events with fewer than 15 seats left
  3. Overdue volunteer tasks
  4. Merch variants with stock ≤ 5 units

---

## 11. All-in-One Digital Student Pass & QR Generator

A single, tamper-proof pass consolidating membership, subscription, and event admissions.

### 11.1 Generate Student Pass (Frontend Request)
- **Method & URL:** `POST https://leifxoxnqnvezbmdtmcr.supabase.co/functions/v1/generate-all-in-one-pass`
- **Headers:**
  ```http
  Authorization: Bearer <STUDENT_AUTH_JWT>
  apikey: <PUBLIC_SUPABASE_ANON_KEY>
  Content-Type: application/json
  ```
- **SDK Method:** `const pass = await api.generateAllInOnePass();`
- **Response:**
  ```json
  {
    "status": "success",
    "pass_token": "SKYPASS:v1:e4a77df3-6c8f...:89abf803c4...",
    "qr_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIE...",
    "qr_svg": "<svg ...></svg>",
    "payload": {
      "student": {
        "full_name": "Rahul Sharma",
        "student_id": "SKY-2026-1042"
      },
      "membership": {
        "is_member": true,
        "tier_name": "Executive / Patron Member",
        "expires_at": "2027-10-10T10:08:49Z",
        "ticket_discount_percent": 25,
        "merch_discount_percent": 20
      },
      "upcoming_events": [
        {
          "ticket_id": "...",
          "event_title": "Skyline Spring Gala 2026",
          "venue": "Grand Hall & Courtyard",
          "starts_at": "2026-10-24T18:00:00Z",
          "ticket_type_name": "VIP Patron Ticket"
        }
      ]
    }
  }
  ```

#### How to render in React:
```tsx
<img 
  src={pass.qr_data_url} 
  alt="Student Pass QR" 
  className="w-56 h-56 rounded-2xl border border-hairline-soft p-2 bg-white" 
/>
```

### 11.2 Door Scanner: Verify Pass Token
- **Method & URL:** `POST https://leifxoxnqnvezbmdtmcr.supabase.co/functions/v1/generate-all-in-one-pass/verify`
- **Headers:** Requires Door Staff / Admin Bearer token.
- **Body:** `{ "pass_token": "SKYPASS:v1:..." }`
- **SDK Method:** `const result = await api.verifyAllInOnePass(scannedToken);`
- **Response:**
  ```json
  {
    "status": "success",
    "verified": true,
    "data": {
      "valid": true,
      "student": { "full_name": "Rahul Sharma" },
      "membership": { "tier_name": "Executive / Patron Member" },
      "upcoming_events": [...]
    }
  }
  ```

---

## 12. Razorpay Payment Gateway & Staff Cash Checkout

### Online Payments (Student Checkout)
```mermaid
sequenceDiagram
    autonumber
    Student UI->>Edge Function: POST /create-payment-order { checkout_id }
    Edge Function-->>Student UI: { razorpay_order_id, amount, currency, key_id }
    Student UI->>Razorpay Modal: Open Razorpay Checkout modal
    Razorpay Modal-->>Student UI: { razorpay_payment_id, razorpay_signature }
    Student UI->>Edge Function: POST /verify-payment { checkout_id, order_id, payment_id, signature }
    Edge Function-->>Student UI: { status: "fulfilled", payment_id }
```

### Staff Cash/UPI Path (Orientation Table / Door Desk)
- **Endpoint:** `POST /functions/v1/record-manual-payment`
- **Body:**
  ```json
  {
    "checkout_id": "uuid",
    "payment_method": "cash",
    "amount_paise": 25000,
    "notes": "Walk-up orientation cash payment"
  }
  ```

---

## 13. Standard Error Handling Protocol

All Edge Functions return errors formatted consistently:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Checkout with ID was not found"
  }
}
```

### Error Code Handling Cheat Sheet:
| Error Code | HTTP Status | Meaning | Recommended UI Reaction |
|---|---|---|---|
| `INVALID_JSON` | `400` | Malformed JSON sent | Dev error: check request payload |
| `INVALID_REQUEST` | `400` | Missing field or invalid UUID | Show field validation message |
| `UNAUTHENTICATED` | `401` | Not logged in | Redirect user to `/login` |
| `FORBIDDEN` | `403` | Role unauthorized | Show "Staff role required" alert |
| `NOT_FOUND` | `404` | Record does not exist | Show 404 / empty state |
| `CONFLICT` | `409` | Capacity full / duplicate scan | Show warning toast / banner |
| `CONFIG_ERROR` | `500` | Missing server secret | Alert backend administrator |
| `INTERNAL_ERROR` | `500` | Unexpected server error | Show generic "Please try again later" |

---

## 14. Frontend Design System Rules (Cheat Sheet)

If you are creating or modifying UI components, please follow these core guidelines from `docs/CampusOne Design.md`:

1. **The Cobalt Rule (`#0064E0`):**
   - Reserve cobalt blue (`var(--color-primary)`) **exclusively** for checkout / commerce buttons (`Buy Tickets`, `Add to Cart`, `Pay Dues`).
   - All other navigation, filter, and marketing buttons MUST use black pill buttons (`#000000`).
2. **Pill-Shape Signature (`rounded-full`):**
   - Buttons, status badges, chips, and search bars MUST use 100px radius (`rounded-full`). Never use square buttons.
3. **Typography:**
   - Use Google Font **Montserrat** with negative snug letter-spacing (`-0.14px`).
4. **Card Elevation:**
   - Use hairline borders (`border border-hairline-soft`) with flat backgrounds. Reserve box-shadows exclusively for checkout modals and sticky purchase rails.
