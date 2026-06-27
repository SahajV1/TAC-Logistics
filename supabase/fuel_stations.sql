-- ============================================================================
-- Migration: Fuel Stations
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database that already has the main schema applied.
-- Safe to re-run (idempotent). Fresh installs get this from schema.sql automatically.
-- ============================================================================

-- Table ----------------------------------------------------------------------
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

-- Keep updated_at fresh
drop trigger if exists trg_fuel_stations_updated on public.fuel_stations;
create trigger trg_fuel_stations_updated before update on public.fuel_stations
  for each row execute function public.set_updated_at();

-- Audit logging
drop trigger if exists trg_audit_fuel_stations on public.fuel_stations;
create trigger trg_audit_fuel_stations
  after insert or update or delete on public.fuel_stations
  for each row execute function public.audit_trigger();

-- Row level security: everyone authenticated reads; only admin writes
alter table public.fuel_stations enable row level security;

drop policy if exists fuel_stations_select on public.fuel_stations;
create policy fuel_stations_select on public.fuel_stations for select to authenticated
  using (true);

drop policy if exists fuel_stations_admin_write on public.fuel_stations;
create policy fuel_stations_admin_write on public.fuel_stations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Seed the stations from the handover sheet (idempotent) ----------------------
insert into public.fuel_stations (name) values
  ('S.S Fillings'),
  ('Tee Ar Fillings'),
  ('Bansis')
on conflict (name) do nothing;
