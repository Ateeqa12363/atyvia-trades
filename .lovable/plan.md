
# Bookings Pipeline — Site Visits → Quotes → Jobs

A single **Bookings** area in the sidebar with three linked stages that match your real workflow.

## The flow

```text
AI call (booked_appointment) ──► Site Visit ──► Quote ──► (accepted) ──► Job ──► completed
        Cal.com booking       auto-created    manual       manual        one-click
```

Every stage is scoped to the currently selected site, same as the rest of the dashboard.

---

## What gets built

### 1. Sidebar
- New group **Bookings** with three items: **Site Visits**, **Quotes**, **Jobs**.
- The existing "Calendar" item stays (Cal.com raw feed).

### 2. Site Visits page (`/bookings/site-visits`)
- Auto-populated from two sources:
  - Any AI call where `booked_appointment = true` → creates a site visit at the call's `appointment_time`.
  - Any Cal.com booking → creates or updates a matching site visit (linked by Cal.com booking id).
- Fields shown: customer name, phone, address (editable after visit), scheduled time, status.
- Status flow: **Scheduled → Visited → Quoted → Cancelled**.
- Row actions: *Mark visited*, *Create quote*, *Cancel*.
- Detail dialog links back to the originating call (transcript + recording).

### 3. Quotes page (`/bookings/quotes`)
- Proper quote records with:
  - Customer + address (pulled from the site visit).
  - Line items: description, quantity, unit price → line total.
  - Auto totals: subtotal, VAT rate (default 20 %, editable), total.
  - Notes / terms field.
  - Status: **Draft → Sent → Accepted → Declined → Expired**.
- Row actions: *Send* (marks sent + timestamp), *Mark accepted* (unlocks "Create job"), *Duplicate*, *Delete*.
- Detail dialog shows the line-item editor and a print-friendly view.

### 4. Jobs page (`/bookings/jobs`)
- Created only from a quote in **Accepted** state (one-click "Create job").
- Fields: customer, address, scheduled date, assigned to (free text for now), quote reference, price, notes.
- Status: **Booked → In progress → Completed → Invoiced → Cancelled**.
- Kanban-style column view + list toggle.

### 5. Dashboard integration
- Replace/augment the current KPIs with a funnel strip: **Calls → Visits → Quotes → Jobs → Revenue (from completed jobs)** for the selected site.
- Live activity keeps working as-is.

---

## Data model (new tables, all with `site_id` + RLS scoped to the owner)

- **site_visits** — `call_id?`, `cal_booking_id?`, `customer_name`, `phone`, `address`, `scheduled_at`, `status`, `notes`.
- **quotes** — `site_visit_id`, `customer_name`, `address`, `subtotal`, `vat_rate`, `total`, `status`, `sent_at?`, `accepted_at?`, `notes`.
- **quote_line_items** — `quote_id`, `description`, `quantity`, `unit_price`, `line_total`, `position`.
- **jobs** — `quote_id`, `site_visit_id`, `customer_name`, `address`, `scheduled_date`, `assigned_to`, `price`, `status`, `notes`.

All get: `GRANT` to authenticated + service_role, RLS via `site_id → sites.user_id = auth.uid()`, and `updated_at` trigger.

---

## Cal.com sync

- Existing `listCalendarBookings` server fn is extended into `syncSiteVisits`:
  - Pulls Cal.com bookings for the selected site.
  - Upserts into `site_visits` keyed on `cal_booking_id`.
  - Also sweeps `calls` where `booked_appointment = true` and no visit exists → creates one.
- Runs on Site Visits page mount + every 60 s (same pattern as calls sync).

---

## Files to add / touch

**New route files**
- `src/routes/_authenticated/bookings/site-visits.tsx`
- `src/routes/_authenticated/bookings/quotes.tsx`
- `src/routes/_authenticated/bookings/jobs.tsx`
- `src/routes/_authenticated/bookings/route.tsx` (layout with `<Outlet />`)

**New server functions**
- `src/lib/bookings.functions.ts` — `listSiteVisits`, `updateSiteVisit`, `syncSiteVisits`, `listQuotes`, `getQuote`, `createQuoteFromVisit`, `updateQuote`, `upsertQuoteLineItems`, `deleteQuote`, `listJobs`, `createJobFromQuote`, `updateJob`. All use `requireSupabaseAuth` and filter by the caller's sites.

**Edits**
- `src/components/layout/AppLayout.tsx` — add Bookings sidebar group.
- `src/routes/_authenticated/index.tsx` (dashboard) — add funnel strip.

**Migrations**
- Four new tables + policies + grants + `updated_at` triggers.

---

## Out of scope for this pass (can layer in later)
- PDF export of quotes (view is print-friendly, so `Ctrl+P` works day one).
- Emailing quotes to customers via Resend.
- Job assignment to real team members (uses free-text field now; wire to a `team_members` table later).
- Invoicing / payments.

If that lines up, I'll ship the migration first (for your approval), then the UI in one follow-up.
