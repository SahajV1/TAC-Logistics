-- ============================================================================
-- Migration: Dealer Ledger
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database. Safe to re-run (idempotent).
--
-- Business flow:
--   * We rent trucks from dealers and accumulate dues (e.g. unpaid rent).
--   * Instead of taking cash, a dealer can fuel his own vehicles at one of
--     our affiliated fuel stations; that fuel bill is deducted from what we
--     owe him.
--   * The remaining balance is settled with cash / bank payments.
--   Outstanding to a dealer = dues − fuel offsets − payments.
-- ============================================================================

-- Dealers (company-wide master; admin-managed) --------------------------------
create table if not exists public.dealers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  phone       text,
  address     text,
  notes       text,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Ledger entries ---------------------------------------------------------------
--   due         → we owe the dealer more (truck rent, etc.)
--   fuel_offset → dealer took fuel at our affiliated pump; reduces the due
--   payment     → cash / bank payment to the dealer; reduces the due
create table if not exists public.dealer_transactions (
  id            uuid primary key default gen_random_uuid(),
  dealer_id     uuid not null references public.dealers(id) on delete cascade,
  txn_date      date not null default current_date,
  txn_type      text not null check (txn_type in ('due','fuel_offset','payment')),
  amount        numeric(12,2) not null check (amount > 0),
  fuel_station  text,             -- fuel_offset: which affiliated pump
  fuel_litres   numeric(10,2),    -- fuel_offset: litres taken (optional)
  reference     text,             -- vehicle no. / rent month / receipt no.
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_dealer_txns_dealer on public.dealer_transactions(dealer_id);
create index if not exists idx_dealer_txns_date   on public.dealer_transactions(txn_date);

-- Keep updated_at fresh
drop trigger if exists trg_dealers_updated on public.dealers;
create trigger trg_dealers_updated before update on public.dealers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_dealer_txns_updated on public.dealer_transactions;
create trigger trg_dealer_txns_updated before update on public.dealer_transactions
  for each row execute function public.set_updated_at();

-- Audit logging
drop trigger if exists trg_audit_dealers on public.dealers;
create trigger trg_audit_dealers
  after insert or update or delete on public.dealers
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_dealer_txns on public.dealer_transactions;
create trigger trg_audit_dealer_txns
  after insert or update or delete on public.dealer_transactions
  for each row execute function public.audit_trigger();

-- Row level security: any signed-in user (staff or admin) can view and record.
-- Dealers are company-wide, so there is no branch scoping here.
alter table public.dealers enable row level security;
alter table public.dealer_transactions enable row level security;

drop policy if exists dealers_admin_all on public.dealers;
drop policy if exists dealers_all on public.dealers;
create policy dealers_all on public.dealers for all to authenticated
  using (true) with check (true);

drop policy if exists dealer_txns_admin_all on public.dealer_transactions;
drop policy if exists dealer_txns_all on public.dealer_transactions;
create policy dealer_txns_all on public.dealer_transactions for all to authenticated
  using (true) with check (true);
