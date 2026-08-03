-- ============================================================================
-- Migration: Link rented dispatches to a dealer
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database. Safe to re-run (idempotent).
-- Requires the Dealer Ledger migration (dealer_ledger.sql) to have run first.
--
-- What it does:
--   Adds a `dealer_id` column to dispatches, so a rented-truck trip can be
--   attributed to a specific dealer from the `dealers` table. This powers the
--   "Rented Vehicles" page: how many trucks and how much rent cost per dealer.
-- ============================================================================

alter table public.dispatches
  add column if not exists dealer_id uuid references public.dealers(id) on delete set null;

create index if not exists idx_dispatches_dealer_id on public.dispatches(dealer_id);
