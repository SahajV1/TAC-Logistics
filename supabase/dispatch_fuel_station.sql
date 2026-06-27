-- ============================================================================
-- Migration: Fuel station on dispatches
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database. Safe to re-run (idempotent).
--
-- What it does:
--   1. Ensures the fuel_stations master list exists (table + triggers + RLS).
--   2. Adds a `fuel_station` text column to dispatches (the station used per trip).
--   3. Seeds the three known stations.
-- ============================================================================

-- 1. Fuel stations master list ----------------------------------------------
create table if not exists public.fuel_stations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  location    text,
  contact     text,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_fuel_stations_updated on public.fuel_stations;
create trigger trg_fuel_stations_updated before update on public.fuel_stations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_fuel_stations on public.fuel_stations;
create trigger trg_audit_fuel_stations
  after insert or update or delete on public.fuel_stations
  for each row execute function public.audit_trigger();

alter table public.fuel_stations enable row level security;

-- Everyone authenticated can read the list (it powers the dispatch dropdown).
drop policy if exists fuel_stations_select on public.fuel_stations;
create policy fuel_stations_select on public.fuel_stations for select to authenticated
  using (true);

-- Direct writes stay admin-only. New stations added from the dispatch form go
-- through the server action's service-role client, which bypasses RLS — so any
-- staff member can grow the list without opening up the table.
drop policy if exists fuel_stations_admin_write on public.fuel_stations;
create policy fuel_stations_admin_write on public.fuel_stations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 2. Dispatch column ---------------------------------------------------------
alter table public.dispatches add column if not exists fuel_station text;

-- 3. Seed known stations (idempotent) ---------------------------------------
insert into public.fuel_stations (name) values
  ('S.S Fillings'),
  ('Tee Ar Fillings'),
  ('Bansis')
on conflict (name) do nothing;
