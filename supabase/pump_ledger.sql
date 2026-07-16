-- ============================================================================
-- Migration: Petrol Pump Ledger (what we owe each affiliated fuel station)
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database. Safe to re-run (idempotent).
--
-- Business flow:
--   * Our trucks fill diesel on credit at affiliated pumps (recorded on each
--     dispatch: fuel_station + fuel_litres + fuel_cost).
--   * Dealers also take fuel at those pumps against their dues (dealer ledger
--     fuel offsets) — that fuel is billed to us as well.
--   * We settle each pump's bill with cash / bank payments recorded here.
--   Outstanding to a pump = dispatch fuel + dealer fuel offsets − payments.
-- ============================================================================

-- Payments to fuel stations. The station is stored by name (free text) — the
-- same convention dispatches.fuel_station and dealer_transactions.fuel_station
-- use; suggestions come from the fuel_stations master list.
create table if not exists public.fuel_station_payments (
  id            uuid primary key default gen_random_uuid(),
  fuel_station  text not null,
  pay_date      date not null default current_date,
  amount        numeric(12,2) not null check (amount > 0),
  reference     text,             -- UPI / cheque / receipt no.
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_pump_payments_station on public.fuel_station_payments(fuel_station);
create index if not exists idx_pump_payments_date    on public.fuel_station_payments(pay_date);

-- Keep updated_at fresh
drop trigger if exists trg_pump_payments_updated on public.fuel_station_payments;
create trigger trg_pump_payments_updated before update on public.fuel_station_payments
  for each row execute function public.set_updated_at();

-- Audit logging
drop trigger if exists trg_audit_pump_payments on public.fuel_station_payments;
create trigger trg_audit_pump_payments
  after insert or update or delete on public.fuel_station_payments
  for each row execute function public.audit_trigger();

-- Row level security: any signed-in user (staff or admin) can view and record.
-- Pumps are company-wide, so there is no branch scoping here.
alter table public.fuel_station_payments enable row level security;

drop policy if exists pump_payments_all on public.fuel_station_payments;
create policy pump_payments_all on public.fuel_station_payments for all to authenticated
  using (true) with check (true);
