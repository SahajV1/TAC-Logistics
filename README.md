# Transport Management System (TMS)

A branch-based transport operations platform for **Lucknow** and **Ghaziabad** — truck dispatch, drivers, trucks, document-expiry tracking with email alerts, salaries, and an admin analytics dashboard. Staff only see their own branch; the Admin sees everything.

Built with **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, **Supabase** (Postgres + Auth + Storage), **Resend** (email) and deployed on **Vercel**.

---

## Features

- **Role-based auth & branch isolation** — enforced in the database with Row Level Security (RLS). Staff are scoped to their branch; Admin has full access.
- **Truck Dispatch** — driver, vehicle, from/to, fuel litres & cost, advance, misc, remarks, company/rented truck type with conditional owner details + rent.
- **Driver, Truck & Document management** — full CRUD. Documents store RC, Insurance, Pollution, Fitness & Permit with file uploads, expiry dates and **renewal history**.
- **Expiry alerts** — dashboard + a dedicated Alerts page, plus **automated daily emails** at 30 / 15 / 7 / 1 days before expiry (and overdue).
- **Audit log** — every create/update/delete is recorded automatically via DB triggers.
- **Admin dashboard & reports** — dispatch analytics, fuel & rent expenses, branch-wise reports, salary management, searchable tables and one-click **Excel export** everywhere.
- **Responsive, production-ready UI**.

---

## Prerequisites

- Node.js **20.9+** (built with Node 24)
- A free **Supabase** project — <https://supabase.com>
- A free **Resend** account for emails — <https://resend.com> (optional but recommended)
- A **Vercel** account for deployment

---

## 1. Install

```bash
npm install
```

## 2. Create the database

1. Create a new project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and **Run**. This creates all tables, RLS policies, audit/expiry triggers, the two branches, and the private `documents` storage bucket.

## 3. Configure environment

Copy `.env.example` to `.env.local` and fill in the values (Supabase keys are at **Project Settings → API**):

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role / secret key (**server only**) |
| `RESEND_API_KEY` | resend.com → API Keys (optional) |
| `EMAIL_FROM` | A verified Resend sender, or `onboarding@resend.dev` for testing |
| `CRON_SECRET` | Any random string — `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL (used in emails) |

## 4. Create the login accounts

Edit the names/emails in [`scripts/seed.mjs`](scripts/seed.mjs) (Admin + 6 Lucknow + 3 Ghaziabad), then:

```bash
npm run seed
```

This creates the auth users and their profiles. The default password is `SEED_DEFAULT_PASSWORD` from `.env.local` — staff should change it after first login. You can also add/edit staff later from the in-app **Staff** page (Admin only).

## 5. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in.

---

## Roles & branches

- **Admin (Shivansh)** — sees and manages all branches and every module, including Staff management and the Audit log.
- **Staff** — scoped to a single branch (Lucknow or Ghaziabad). They can only read and write records for their own branch; this is enforced by Postgres RLS, not just the UI.

## Email notifications & cron

- The route `GET /api/cron/check-expiry` computes documents/licences hitting the 30/15/7/1-day thresholds (and overdue) and emails each branch's staff + all admins via Resend.
- [`vercel.json`](vercel.json) schedules it daily at **03:00 UTC**. On Vercel, set `CRON_SECRET` as an env var — Vercel automatically sends it as a `Bearer` token, and the route rejects anything else.
- No Resend key? The dashboard and Alerts page still work; only the emails are skipped.

To test the job locally:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/check-expiry
```

---

## Deploy to Vercel

1. Push this repo to GitHub and **Import** it in Vercel.
2. Add **all** the variables from `.env.local` in **Project → Settings → Environment Variables** (including `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`). Set `NEXT_PUBLIC_APP_URL` to the production URL.
3. Deploy. The cron in `vercel.json` is registered automatically.
4. Run the seed once against the production database (`npm run seed` with production keys in `.env.local`) or create accounts from the Staff page.

> The build uses Turbopack (Next.js 16 default). No extra config needed.

---

## Project structure

```
supabase/schema.sql        # Full DB schema: tables, RLS, triggers, storage
scripts/seed.mjs           # Creates admin + 9 staff accounts
src/
  proxy.ts                 # Session refresh + route protection (Next 16 "proxy")
  lib/
    supabase/              # browser / server / admin / proxy clients
    auth.ts                # getCurrentUser, requireUser, requireAdmin
    schemas.ts             # Zod schemas shared by client & server
    types.ts, constants.ts, format.ts, expiry.ts, email.ts
  components/              # DataTable, form fields, badges, app shell, …
  app/
    login/                 # Auth pages + server actions
    (app)/                 # Authenticated shell + all modules
      page.tsx             # Dashboard
      dispatch/ drivers/ trucks/ documents/ alerts/
      salaries/ reports/ users/ audit/
    api/cron/check-expiry/ # Daily expiry email job
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Create the admin + staff accounts |
