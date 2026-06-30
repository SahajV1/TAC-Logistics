-- ============================================================================
-- Migration: Toll on dispatches + Advance on salaries
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database. Safe to re-run (idempotent).
--
-- What it does:
--   1. Adds a `toll_amount` column to dispatches (toll charges per trip).
--   2. Adds an `advance` column to salaries (advance already paid to the person).
--   3. Recomputes the generated `net_salary` column to subtract advance:
--        net_salary = base_salary + bonus - deductions - advance
-- ============================================================================

-- 1. Dispatch toll -----------------------------------------------------------
alter table public.dispatches
  add column if not exists toll_amount numeric(12,2) not null default 0;

-- 2 & 3. Salary advance + net recompute --------------------------------------
-- Add the advance column first so the generated expression can reference it.
alter table public.salaries
  add column if not exists advance numeric(12,2) not null default 0;

-- A generated column's expression can't be ALTERed in place, so drop & re-add.
-- Dropping then re-adding is idempotent: a re-run drops the (possibly old)
-- definition and recreates it with the advance-aware expression.
alter table public.salaries drop column if exists net_salary;
alter table public.salaries
  add column net_salary numeric(12,2)
  generated always as (base_salary + bonus - deductions - advance) stored;
