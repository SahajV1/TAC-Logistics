-- ============================================================================
-- Migration: App Settings (fuel price per litre)
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database. Safe to re-run (idempotent).
--
-- What it does:
--   Adds a singleton app_settings table holding the current fuel price per
--   litre. Admins update it from the dashboard; the dispatch form reads it
--   to auto-calculate fuel cost from litres, so staff never type a rate.
-- ============================================================================

create table if not exists public.app_settings (
  id                    uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  fuel_price_per_litre  numeric(10,2) not null default 0,
  updated_by            uuid references public.profiles(id) on delete set null,
  updated_at            timestamptz not null default now(),
  constraint app_settings_singleton check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

insert into public.app_settings (id) values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

drop trigger if exists trg_app_settings_updated on public.app_settings;
create trigger trg_app_settings_updated before update on public.app_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_app_settings on public.app_settings;
create trigger trg_audit_app_settings
  after insert or update or delete on public.app_settings
  for each row execute function public.audit_trigger();

-- Row level security: everyone authenticated reads; only admin writes
alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated
  using (true);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
