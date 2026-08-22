-- ============================================================================
-- Migration: Auto-sync rented dispatches to the dealer ledger
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database. Safe to re-run (idempotent).
--
-- What it does:
--   1. Adds "advance given to dealer" and "fuel taken by dealer" fields to
--      rented dispatches (both offset the rent owed to the dealer).
--   2. Links dealer_transactions back to the dispatch that generated them.
--      The app deletes and recreates a dispatch's auto entries on every
--      save, so ON DELETE CASCADE keeps the ledger in sync when a dispatch
--      itself is deleted.
-- ============================================================================

alter table public.dispatches
  add column if not exists rented_advance_amount numeric(12,2) not null default 0,
  add column if not exists rented_fuel_litres     numeric(10,2) not null default 0,
  add column if not exists rented_fuel_cost       numeric(12,2) not null default 0,
  add column if not exists rented_fuel_station    text;

alter table public.dealer_transactions
  add column if not exists dispatch_id uuid references public.dispatches(id) on delete cascade;

create index if not exists idx_dealer_txns_dispatch on public.dealer_transactions(dispatch_id);
