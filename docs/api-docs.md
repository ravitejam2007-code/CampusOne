# CampusOne API Documentation

**Project:** CampusOne — Odoo × NMIT Hackathon 2026  
**Version:** 1.0  
**Status:** Proposed API contract  
**Backend:** Supabase BaaS  
**Frontend:** Astro.js + TypeScript + Tailwind CSS v4  
**Database:** Supabase PostgreSQL  
**Payments:** Razorpay Test Mode

---

## 1. API Overview

CampusOne is a student organization management platform covering six workflows:

1. Student membership and renewals
2. Events, ticket sales, and QR check-in
3. Announcements and mailing preferences
4. Merchandise and inventory
5. Fundraising and volunteer tasks
6. Treasurer dashboard and financial ledger

The application uses Supabase as its backend. There is no separately hosted Express.js API server.

### Architecture

```text
Astro.js Frontend
       |
       | Supabase Auth / REST / RPC
       v
Supabase Platform
  ├── PostgreSQL Database
  ├── Row-Level Security
  ├── Supabase Auth
  ├── Supabase Storage
  ├── Edge Functions
  └── pg_cron
       |
       ├── Razorpay API
       └── Email Provider (optional)
```

### API access patterns

| Pattern | Purpose |
|---|---|
| Supabase REST API | Read and write records allowed by RLS |
| PostgreSQL RPC | Atomic multi-table operations |
| Supabase Edge Functions | Payments, webhooks, privileged workflows |
| Supabase Auth | Registration, login, session management |
| Supabase Storage | Private files and protected uploads |
| pg_cron | Scheduled renewal reminders and reservation expiry |

### Base URLs

```text
Supabase REST:
https://<project-ref>.supabase.co/rest/v1

Supabase Auth:
https://<project-ref>.supabase.co/auth/v1

Supabase Functions:
https://<project-ref>.supabase.co/functions/v1
```

Replace `<project-ref>` with the actual Supabase project reference.

---

## 2. Authentication

CampusOne uses Supabase Auth with email/password authentication.

### 2.1 Register

**Method:** `POST`

```text
/auth/v1/signup
```

Request:

```json
{
  "email": "student@example.com",
  "password": "StrongPassword123!",
  "data": {
    "full_name": "Example Student"
  }
}
```

Response: Supabase Auth user/session response, depending on email confirmation settings.

### 2.2 Login

**Method:** `POST`

```text
/auth/v1/token?grant_type=password
```

Request:

```json
{
  "email": "student@example.com",
  "password": "StrongPassword123!"
}
```

The response contains the authenticated user and session tokens according to the configured Supabase Auth flow.

### 2.3 Logout

**Method:** `POST`

```text
/auth/v1/logout
```

Send the authenticated access token.

### 2.4 Authentication headers

For Supabase REST and RPC requests:

```http
apikey: <SUPABASE_PUBLISHABLE_KEY>
Authorization: Bearer <USER_ACCESS_TOKEN>
Content-Type: application/json
```

Use the current Supabase publishable-key configuration. Never expose the Supabase service-role or secret key in browser code.

### 2.5 Astro session handling

For authenticated server-rendered pages, use `@supabase/ssr` and secure cookie-based session handling.

If protected screens are implemented as client-side islands instead, use the supported Supabase client session flow and enforce authorization in the database regardless.

Authentication alone does not grant a role. Roles must be assigned and enforced separately.

---

## 3. Roles and Permissions

The application uses five roles.

| Capability | Admin | Treasurer | Door staff | Volunteer | Member |
|---|---:|---:|---:|---:|---:|
| Manage users and roles | Yes | No | No | No | No |
| Manage events | Yes | Limited financial access | No | Limited | No |
| Sell tickets at the door | Yes | Yes | Yes | If assigned | No |
| Verify membership | Yes | Yes | Yes | If assigned | Own membership |
| Check in attendees | Yes | No | Yes | If assigned | No |
| Publish announcements | Yes | No | No | If assigned | No |
| Manage merchandise | Yes | Financial visibility | No | If assigned | No |
| Manage fundraiser tasks | Yes | Financial visibility | No | Yes | Own assigned tasks |
| Record audited cash income | Yes | Yes | Authorized sales only | No by default | No |
| View complete financial ledger | Yes | Yes | No | No | No |
| View personal orders and tickets | Yes | Yes | No | No | Yes |

**Implementation rule:** Enforce permissions using PostgreSQL grants, RLS policies, and server-side Edge Function checks. Do not rely on hiding frontend buttons.

Role names and the permission table are the intended policy. Exact database policies must be implemented and tested before production use.

---

## 4. Data Model

The following tables define the minimum proposed data model. Additional columns such as timestamps, foreign keys, and audit fields should be added as required.

### Identity and membership

```text
profiles
  id
  full_name
  email

user_roles
  user_id
  role

membership_tiers
  id
  name
  price
  duration_days
  ticket_discount_percent
  merch_discount_percent
  benefits
  active

memberships
  id
  user_id
  membership_tier_id
  starts_at
  expires_at
  status

membership_reminders
  id
  membership_id
  reminder_type
  scheduled_for
  sent_at
  status
```

### Events and tickets

```text
events
  id
  title
  description
  starts_at
  venue
  capacity
  ticket_price
  member_ticket_price
  status

tickets
  id
  checkout_id
  event_id
  user_id
  qr_token
  status
  checked_in_at
  checked_in_by
```

### Checkout and payment

```text
checkouts
  id
  user_id
  status
  subtotal
  discount_amount
  total_amount
  payment_method
  payment_status
  razorpay_order_id
  idempotency_key
  created_by
  created_at

checkout_items
  id
  checkout_id
  item_type
  item_id
  quantity
  unit_price
  discount_amount
  line_total

payments
  id
  checkout_id
  provider
  provider_payment_id
  amount
  status
  verified_at

ledger_entries
  id
  entry_type
  amount
  category
  source_type
  source_id
  recorded_by
  payment_method
  notes
  created_at

audit_logs
  id
  actor_id
  action
  entity_type
  entity_id
  details
  created_at
```

### Merchandise

```text
merchandise
  id
  name
  description
  active

merchandise_variants
  id
  merchandise_id
  size
  color
  price
  stock_quantity

stock_reservations
  id
  checkout_id
  variant_id
  quantity
  status
  expires_at
```

### Announcements

```text
announcements
  id
  title
  body
  audience
  published_at
  published_by
  status

mailing_preferences
  user_id
  email
  subscribed
  unsubscribed_at
```

### Fundraising

```text
fundraisers
  id
  title
  goal_amount
  raised_amount
  status

fundraiser_tasks
  id
  fundraiser_id
  title
  description
  assigned_to
  status
  due_at

fundraiser_contributions
  id
  fundraiser_id
  amount
  payment_method
  recorded_by
  notes
  ledger_entry_id
  created_at
```

**Important:** `raised_amount` and other dashboard totals should be derived from verified financial records or updated atomically. Do not treat an editable total as authoritative financial evidence.

---

## 5. Common API Conventions

### JSON format

Requests and responses use JSON unless an endpoint specifically accepts a raw webhook body or file upload.

### IDs

Use UUIDs for application records unless an external provider defines its own identifier.

### Pagination

For Supabase REST queries, use range-based pagination:

```http
Range: 0-19
```

Use appropriate ordering and filtering so that pages remain deterministic.

### Standard application error

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

Suggested error codes:

| HTTP status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Invalid parameters or payload |
| 401 | `UNAUTHENTICATED` | Missing or invalid session |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Record not found |
| 409 | `CONFLICT` | Duplicate action, stale stock, or invalid state |
| 422 | `VALIDATION_ERROR` | Business validation failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |
| 502 | `PAYMENT_PROVIDER_ERROR` | Provider request failed |

These are the proposed application-level conventions. Supabase may return its own error structures for direct REST, Auth, and RPC calls; normalize them in the frontend where appropriate.

---

## 6. Supabase REST and RPC

### 6.1 Read published events

**Method:** `GET`

```text
/rest/v1/events?select=*&status=eq.published&order=starts_at.asc
```

The database policy must restrict access to fields and records that the current user may read.

### 6.2 Read membership tiers

**Method:** `GET`

```text
/rest/v1/membership_tiers?select=*&active=eq.true
```

### 6.3 Read the announcement feed

**Method:** `GET`

```text
/rest/v1/announcements?select=*&status=eq.published&order=published_at.desc
```

The query and RLS policies must ensure that the user sees only announcements for their intended audience.

### 6.4 Read merchandise

**Method:** `GET`

```text
/rest/v1/merchandise?select=*&active=eq.true
```

Load variants and stock availability separately or through an appropriately secured view.

### 6.5 Call an RPC

**Method:** `POST`

```text
/rest/v1/rpc/<function_name>
```

Example request:

```http
POST /rest/v1/rpc/get_treasurer_overview
Authorization: Bearer <USER_ACCESS_TOKEN>
apikey: <SUPABASE_PUBLISHABLE_KEY>
Content-Type: application/json
```

```json
{
  "p_start_date": "2026-10-01",
  "p_end_date": "2026-10-31"
}
```

The function name and parameters are a proposed contract. Create and secure the corresponding PostgreSQL function before calling it from the frontend.

---

## 7. Unified Checkout

CampusOne uses a single checkout model for:

- Event tickets
- Merchandise
- Membership purchases and renewals

Payment methods:

```text
online
cash
manual_upi
```

Payment status and checkout status must remain separate. For example, an online payment can be initiated but not yet verified, while a checkout can be fulfilled only after its payment has been accepted.

### 7.1 Create a checkout

**Proposed RPC:** `create_checkout`

**Method:** `POST`

```text
/rest/v1/rpc/create_checkout
```

Example ticket request:

```json
{
  "p_items": [
    {
      "item_type": "ticket",
      "item_id": "EVENT_UUID",
      "quantity": 2
    }
  ],
  "p_payment_method": "online",
  "p_idempotency_key": "client-generated-unique-key"
}
```

The database function must:

1. Validate the authenticated user.
2. Validate the requested items and quantities.
3. Obtain prices from trusted database records, not client-supplied totals.
4. Check active membership and applicable discount rules.
5. Validate ticket capacity or merchandise stock.
6. Create the checkout and its items transactionally.
7. Reserve inventory or ticket capacity when appropriate.
8. Return the checkout ID and calculated total.

Example response:

```json
{
  "checkout_id": "CHECKOUT_UUID",
  "status": "pending",
  "payment_method": "online",
  "subtotal": 1000,
  "discount_amount": 100,
  "total_amount": 900,
  "currency": "INR"
}
```

The figures above are illustrative examples, not configured prices.

### 7.2 Create a Razorpay order

**Proposed Edge Function:** `create-payment-order`

**Method:** `POST`

```text
/functions/v1/create-payment-order
```

Request:

```json
{
  "checkout_id": "CHECKOUT_UUID"
}
```

The function must authenticate the user and verify ownership or an authorized staff role. It must load the authoritative total from the database and create the Razorpay order server-side.

Example response:

```json
{
  "checkout_id": "CHECKOUT_UUID",
  "razorpay_order_id": "order_provider_id",
  "amount": 90000,
  "currency": "INR",
  "key_id": "RAZORPAY_TEST_KEY_ID"
}
```

Razorpay order amounts are represented in the smallest currency unit. For INR, ₹900 is `90000` paise.

The browser receives only the public Razorpay Key ID, never the Razorpay Key Secret.

### 7.3 Verify payment completion

The browser's checkout-success callback is not sufficient proof of payment.

**Proposed Edge Function:** `verify-payment`

**Method:** `POST`

```text
/functions/v1/verify-payment
```

Request:

```json
{
  "checkout_id": "CHECKOUT_UUID",
  "razorpay_order_id": "order_provider_id",
  "razorpay_payment_id": "payment_provider_id",
  "razorpay_signature": "provider-generated-signature"
}
```

The function must:

1. Authenticate the user or verify an authorized workflow.
2. Load the checkout and expected Razorpay order from the database.
3. Verify the Razorpay signature using the secret on the server.
4. Verify the order/checkout relationship and expected amount.
5. Prevent replay and duplicate fulfilment.
6. Record payment verification.
7. Call the single fulfilment RPC.
8. Return the persisted checkout state.

Example response:

```json
{
  "checkout_id": "CHECKOUT_UUID",
  "payment_status": "verified",
  "checkout_status": "fulfilled"
}
```

Only return `fulfilled` after the database confirms that fulfilment succeeded.

### 7.4 Fulfil checkout

**Proposed RPC:** `fulfill_checkout`

This function must be atomic and idempotent. It should:

- Create tickets for ticket items.
- Create or activate the purchased membership.
- Reduce or finalize reserved merchandise stock.
- Mark the checkout fulfilled.
- Create the appropriate immutable ledger posting.
- Prevent duplicate fulfilment if the function is retried.

If an operation fails, the transaction must roll back rather than leaving partially fulfilled items.

### 7.5 Record cash or manual UPI sales

**Proposed Edge Function:** `record-manual-payment`

**Method:** `POST`

```text
/functions/v1/record-manual-payment
```

Request:

```json
{
  "checkout_id": "CHECKOUT_UUID",
  "payment_method": "cash",
  "reference": null,
  "notes": "Sold at campus registration desk"
}
```

For manual UPI, provide a transaction reference when available:

```json
{
  "checkout_id": "CHECKOUT_UUID",
  "payment_method": "manual_upi",
  "reference": "UPI_TRANSACTION_REFERENCE",
  "notes": "Verified by authorized treasurer"
}
```

The function must:

- Require an authorized staff role.
- Validate the checkout amount against database records.
- Record the actor, time, method, and notes.
- Reject duplicate posting.
- Invoke the same fulfilment workflow after accepting the payment.
- Create a ledger entry exactly once.
- Record the action in the audit log.

Manual UPI entries are staff-verified records; they are not automatically verified by Razorpay.

---

## 8. Razorpay Webhook

**Proposed Edge Function:** `razorpay-webhook`

**Method:** `POST`

```text
/functions/v1/razorpay-webhook
```

This provider-to-server endpoint does not use a browser's Supabase access token.

Deploy it with JWT verification disabled because Razorpay does not send a Supabase user JWT:

```bash
supabase functions deploy razorpay-webhook --no-verify-jwt
```

Disabling JWT verification does not make the endpoint trusted by default. The function must verify the Razorpay webhook signature using the configured webhook secret.

### Required processing

1. Read the request body as raw text using `await req.text()`.
2. Read the Razorpay signature header.
3. Verify the signature over the exact raw body using HMAC-SHA256.
4. Parse JSON only after signature verification.
5. Validate the event type and expected order/payment relationships.
6. Store a unique webhook event or provider event identifier.
7. Ignore already-processed events safely.
8. Update payment status and invoke idempotent fulfilment when appropriate.
9. Return a successful response for safely processed or already-processed events.

Use plain `fetch`, Basic Authentication where required by Razorpay's API, and Web Crypto for HMAC in Deno Edge Functions. The Node.js Razorpay SDK is not required.

**Do not trust a client-supplied success status.** A webhook event must also be checked against the expected checkout, amount, currency, and payment state.

---

## 9. Events, Tickets, and QR Check-in

### 9.1 List event tickets

Authenticated users can retrieve their own tickets through a secured REST query or RPC.

Example:

```text
GET /rest/v1/tickets?select=id,event_id,status,checked_in_at
```

RLS must restrict the response to the current user's tickets unless an authorized staff workflow is being used.

### 9.2 QR token strategy

Use a reproducible, signed token derived from a ticket ID, such as:

```text
token = HMAC-SHA256(QR_SECRET, ticket_id)
```

The secret must remain server-side. The QR payload may contain an opaque ticket identifier and its signature.

The server must verify the signature and load the actual ticket state. Do not treat a QR code itself as proof that a ticket is valid.

Alternatively, store a random token securely if the chosen implementation needs random token revocation.

### 9.3 Check in an attendee

**Proposed Edge Function:** `check-in-ticket`

**Method:** `POST`

```text
/functions/v1/check-in-ticket
```

Request:

```json
{
  "qr_payload": "SIGNED_TICKET_PAYLOAD"
}
```

Response:

```json
{
  "valid": true,
  "ticket_status": "checked_in",
  "checked_in_at": "2026-10-10T10:30:00Z"
}
```

The function must require door-staff or administrator authorization, verify the ticket, and atomically prevent a second check-in.

For repeat requests, return a clear `409 CONFLICT` or an explicitly documented already-checked-in result.

### 9.4 Manual attendee lookup

**Proposed Edge Function:** `lookup-attendee`

**Method:** `POST`

```text
/functions/v1/lookup-attendee
```

Request:

```json
{
  "event_id": "EVENT_UUID",
  "query": "student@example.com"
}
```

The screen should support lookup by attendee name or email when camera scanning fails or connectivity is poor.

The endpoint must limit results, avoid exposing unnecessary personal information, and require door-staff authorization.

A manual lookup is not an offline database. If Wi-Fi is unavailable, a truly offline check-in mode requires a separately designed secure local cache and synchronization strategy. That mode is outside the initial P0 scope.

### 9.5 Verify membership

**Proposed Edge Function:** `verify-membership`

**Method:** `POST`

```text
/functions/v1/verify-membership
```

Request:

```json
{
  "query": "student@example.com"
}
```

Response:

```json
{
  "found": true,
  "membership_status": "active",
  "membership_tier": "Student Member",
  "expires_at": "2027-10-10T00:00:00Z"
}
```

Return only the information required for membership verification.

### 9.6 Event summary

**Proposed RPC:** `get_event_summary`

Return:

- Tickets sold
- Tickets checked in
- Remaining capacity
- Verified online revenue
- Recorded cash/manual-UPI revenue
- Refunds, if implemented
- Revenue total with payment-method breakdown

The summary must derive from persisted records, not browser-maintained counters.

---

## 10. Membership and Renewal Reminders

### 10.1 Read the current membership

**Method:** `GET`

```text
/rest/v1/memberships?select=*,membership_tiers(*)&user_id=eq.<CURRENT_USER_ID>
```

RLS must enforce ownership. Prefer using the authenticated user's ID rather than accepting arbitrary IDs from the client.

### 10.2 Renew membership

Membership renewal uses the unified checkout flow:

```json
{
  "p_items": [
    {
      "item_type": "membership",
      "item_id": "MEMBERSHIP_TIER_UUID",
      "quantity": 1
    }
  ],
  "p_payment_method": "online",
  "p_idempotency_key": "renewal-unique-key"
}
```

The purchase is fulfilled only after payment is verified or an authorized staff member records an accepted manual payment.

### 10.3 Renewal reminder scheduler

Use `pg_cron` to identify memberships approaching expiry and create reminders for:

- 30 days before expiry
- 7 days before expiry

The scheduled workflow should be idempotent and prevent duplicate reminders for the same membership and reminder interval.

Email delivery is optional. The in-app notification or membership screen should remain the primary experience until a verified sender domain and provider configuration are available.

---

## 11. Announcements

### 11.1 Read announcements

**Method:** `GET`

```text
/rest/v1/announcements?select=*&status=eq.published&order=published_at.desc
```

Apply audience filtering through secure database policies or a secured RPC.

Possible audiences include:

```text
all_members
active_members
volunteers
event_attendees
```

These values are proposed categories; enforce a defined database constraint before implementation.

### 11.2 Publish an announcement

**Proposed Edge Function:** `publish-announcement`

**Method:** `POST`

```text
/functions/v1/publish-announcement
```

Request:

```json
{
  "title": "Upcoming Campus Event",
  "body": "Registration is now open.",
  "audience": "all_members"
}
```

Require administrator authorization or another explicitly assigned publishing permission.

### 11.3 Mailing preferences

A user must be able to opt out of non-essential announcement email without losing access to required account or payment communications.

**Proposed RPC:** `update_mailing_preference`

```json
{
  "p_subscribed": false
}
```

The function must update only the authenticated user's preference.

The announcement feed is the primary channel. Resend or another email provider is a bonus and must be configured with a verified sender domain or another provider-approved sender arrangement.

---

## 12. Merchandise and Inventory

### 12.1 Read merchandise variants

Load merchandise and its variants, including available sizes, colors, prices, and stock availability.

Do not expose internal stock-reservation records or privileged inventory fields to ordinary users.

### 12.2 Purchase merchandise

Use the same checkout and payment flow as event tickets.

Example:

```json
{
  "p_items": [
    {
      "item_type": "merch",
      "item_id": "MERCHANDISE_VARIANT_UUID",
      "quantity": 1
    }
  ],
  "p_payment_method": "online",
  "p_idempotency_key": "merch-order-unique-key"
}
```

The database must calculate membership discounts and prices from trusted records.

### 12.3 Stock reservation requirements

The checkout process must atomically check stock and reserve the requested quantity. Two simultaneous checkouts must not reserve more units than are available.

Reservations should expire after a configured interval if payment is not completed.

Use `pg_cron` to process expired reservations and release stock safely. The reservation-expiry operation must be idempotent.

On successful fulfilment, finalize the stock deduction exactly once.

---

## 13. Fundraising and Volunteer Tasks

### 13.1 List fundraiser tasks

**Method:** `GET`

```text
/rest/v1/fundraiser_tasks?select=*&order=due_at.asc
```

Apply RLS to limit volunteers to appropriate task information and permit updates only to authorized users or assigned volunteers.

### 13.2 Update a task

**Proposed RPC:** `update_fundraiser_task`

```json
{
  "p_task_id": "TASK_UUID",
  "p_status": "completed"
}
```

The database must validate allowed state transitions and authorization.

### 13.3 Record cash fundraiser income

**Proposed Edge Function:** `record-fundraiser-contribution`

**Method:** `POST`

```text
/functions/v1/record-fundraiser-contribution
```

Request:

```json
{
  "fundraiser_id": "FUNDRAISER_UUID",
  "amount": 250,
  "payment_method": "cash",
  "notes": "Bake-sale collection"
}
```

Only authorized staff should record cash income. If the project permits a volunteer to enter a contribution, that permission must be explicit and the record may require treasurer verification.

The contribution and its corresponding ledger entry must be linked and created transactionally. Retries must not duplicate the income.

### 13.4 Fundraiser progress

**Proposed RPC:** `get_fundraiser_progress`

Return:

```json
{
  "fundraiser_id": "FUNDRAISER_UUID",
  "goal_amount": 10000,
  "raised_amount": 4250,
  "tasks_total": 8,
  "tasks_completed": 5,
  "progress_percent": 42.5
}
```

The numbers are illustrative. The actual response must be calculated from stored fundraising and task records.

---

## 14. Treasurer Dashboard and Ledger

### 14.1 Overview

**Proposed RPC:** `get_treasurer_overview`

**Method:** `POST`

```text
/rest/v1/rpc/get_treasurer_overview
```

Request:

```json
{
  "p_start_date": "2026-10-01",
  "p_end_date": "2026-10-31"
}
```

Response:

```json
{
  "period": {
    "start_date": "2026-10-01",
    "end_date": "2026-10-31"
  },
  "opening_balance": 0,
  "income_total": 4250,
  "expense_total": 1200,
  "closing_balance": 3050,
  "income_by_method": {
    "online": 2500,
    "cash": 1000,
    "manual_upi": 750
  }
}
```

The figures are examples only. The actual dashboard must calculate values from ledger records and apply the defined accounting rules.

### 14.2 Ledger requirements

The ledger must cover accepted income from:

- Membership dues
- Event tickets
- Merchandise sales
- Fundraiser contributions

It should also cover recorded expenses and refunds if those workflows are implemented.

Financial records must include source references and actor details for staff-recorded transactions.

### 14.3 Immutable financial history

Do not silently overwrite or delete posted ledger entries.

If a correction is required, use a compensating entry with a reason and an audit record.

### 14.4 Expenses

Expense recording and reimbursement can be included if time permits, but the P0 priority is a reliable income/expense/balance overview backed by persisted records.

---

## 15. Edge Function Inventory

These are the proposed application endpoints to implement.

| Function | Method | Authorization |
|---|---|---|
| `create-payment-order` | POST | Authenticated owner or authorized staff |
| `verify-payment` | POST | Authenticated owner or authorized staff |
| `razorpay-webhook` | POST | Razorpay signature verification |
| `record-manual-payment` | POST | Authorized staff |
| `check-in-ticket` | POST | Door staff/admin |
| `lookup-attendee` | POST | Door staff/admin |
| `verify-membership` | POST | Authorized staff |
| `publish-announcement` | POST | Admin or explicitly authorized publisher |
| `record-fundraiser-contribution` | POST | Authorized staff |
| `get-event-summary` | Prefer secured RPC | Authorized event/financial role |

Use Supabase REST for straightforward reads and writes where RLS provides the correct security boundary. Do not create an Edge Function for every database query.

---

## 16. Security Requirements

### Secrets

Store secrets in Supabase Edge Function secrets or the appropriate server-side deployment environment.

Example secret names:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
QR_HMAC_SECRET
EMAIL_PROVIDER_API_KEY
```

The Supabase publishable key may be used in browser code. Never expose a Supabase service-role/secret key, Razorpay secret, webhook secret, or QR HMAC secret to the browser.

### Row-Level Security

Enable RLS on all tables accessible through the API.

Minimum rules:

- Members can access their own profile, membership, checkouts, and tickets.
- Members cannot assign themselves roles.
- Volunteers can access assigned tasks and permitted fundraising information.
- Door staff can verify tickets and membership but cannot access the complete ledger.
- Treasurers can view financial records and use authorized finance workflows.
- Administrators can perform approved management actions.
- Public users can only read explicitly published public content.

### Edge Function CORS

Configure CORS explicitly in each browser-facing Edge Function. Allow only the expected frontend origins, required methods, and required headers. Do not treat CORS as authentication or authorization.

The Razorpay webhook is a provider-to-server request and should not rely on browser CORS behavior.

### Idempotency

Payment verification, webhook processing, cash recording, ticket check-in, fulfilment, stock reservation, and ledger posting must be safe to retry.

Use unique constraints and database transactions as the final protection against duplicate operations.

### Input validation

Validate UUIDs, quantities, amounts, allowed status transitions, audience values, and payment methods on the server or database boundary.

Never accept the client's calculated total as authoritative.

### Audit trail

Record sensitive staff actions, including cash entries, manual UPI verification, role changes, check-in overrides, and financial corrections.

---

## 17. Environment Configuration

### Frontend

```env
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
PUBLIC_RAZORPAY_KEY_ID=<test-key-id>
```

Only expose values intended for browser use.

### Supabase Edge Functions

```env
RAZORPAY_KEY_ID=<test-key-id>
RAZORPAY_KEY_SECRET=<test-key-secret>
RAZORPAY_WEBHOOK_SECRET=<webhook-secret>
QR_HMAC_SECRET=<strong-server-side-secret>
EMAIL_PROVIDER_API_KEY=<optional-provider-key>
```

Configure secrets using Supabase's supported secret-management mechanism. Do not commit actual values to Git.

`PUBLIC_API_BASE_URL`, Express-specific Helmet configuration, and a separately hosted API service are not required for this Supabase-first architecture.

---

## 18. Scheduled Jobs

Use `pg_cron` for the scheduled database workflows:

1. Create renewal reminders 30 days before membership expiry.
2. Create renewal reminders 7 days before membership expiry.
3. Expire unpaid checkouts and reservations after their configured deadline.
4. Release expired merchandise reservations.
5. Optionally process queued notification records.

Keep database state transitions in transactional functions. A scheduled job must not assume that an email was delivered merely because a reminder record exists.

Test each scheduled function manually before configuring its recurring schedule.

---

## 19. Error Handling and Observability

The frontend should:

- Display useful, non-sensitive error messages.
- Preserve checkout state after temporary network failures.
- Prevent repeated clicks from creating duplicate operations.
- Refresh authoritative status after a payment redirect.
- Show clear empty states when no real records exist.

Edge Functions should log request correlation IDs, outcome, and safe error details. Do not log passwords, access tokens, secret keys, full payment credentials, or unnecessary personal information.

For financial operations, record enough audit information to trace the checkout, payment, ledger entry, and staff actor.

---

## 20. Local Development and Deployment

### Setup

1. Create a Supabase project.
2. Configure Auth and email-confirmation behavior.
3. Create version-controlled database migrations.
4. Define tables, constraints, indexes, grants, and RLS policies.
5. Implement and test transactional RPC functions.
6. Implement the required Edge Functions.
7. Configure Razorpay Test Mode credentials and webhook.
8. Configure `pg_cron` and verify scheduled workflows.
9. Connect the Astro frontend to Supabase.
10. Deploy the frontend and configure the production frontend origin for Edge Function CORS.

### Testing priorities

Before the demo, verify:

- A member cannot read another member's private records.
- A user cannot grant themselves a privileged role.
- Two concurrent purchases cannot oversell event capacity or merchandise stock.
- Repeated webhook delivery does not create duplicate tickets or ledger entries.
- Invalid Razorpay signatures are rejected.
- Unauthorized staff cannot record cash income.
- A ticket cannot be checked in twice.
- Membership discounts are calculated from trusted tier data.
- Renewal reminders and expired reservations are processed without duplication.
- Treasurer totals reconcile to the underlying ledger entries.

### Demo records

Create clearly labelled demo-club accounts and records through the actual application workflows. Provide pre-provisioned accounts for the roles needed in the demonstration.

Do not hard-code dashboard totals, fake payment success, or present fabricated transactions as verified payments. Use Razorpay Test Mode for the payment demonstration and real database records for the other scenes.

---

## 21. Implementation Order

### P0 — Hackathon demo

1. Supabase Auth, profiles, roles, and RLS.
2. Membership tiers, signup, expiry, and verification.
3. Unified checkout and payment model.
4. Event ticket sales, QR check-in, and door cash sales.
5. Announcements feed.
6. Merchandise variants, stock reservation, and member discount.
7. Fundraiser task board and audited cash contributions.
8. Treasurer income/expense/balance overview.
9. Renewal reminders and reservation expiry through `pg_cron`.
10. Five-minute demonstration across all six scenes.

### Deferred unless time remains

- Advanced financial reconciliation.
- CSV export.
- AI features and advanced analytics.
- Multiple-organization switching.
- Complex reimbursement approval workflows.
- A dedicated offline check-in synchronization system.
- Automated mass-email delivery if sender verification is not ready.

---

## 22. Contract Status and Important Notes

The endpoint paths, RPC names, request schemas, table names, and sample responses in this document are proposed contracts for implementation. They are not evidence that those functions already exist in the Supabase project.

Before frontend integration, create the corresponding migrations and functions, settle any naming differences, and validate request/response schemas against the deployed implementation.

For external provider details, follow the current official Supabase and Razorpay documentation, especially for authentication, payment signatures, webhook events, and deployment configuration.
