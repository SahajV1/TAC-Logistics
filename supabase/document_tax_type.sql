-- ============================================================================
-- Migration: Tax document type
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- on an EXISTING database. Safe to re-run (idempotent).
--
-- What it does:
--   Allows 'tax' as a document type, so a vehicle's road tax can be tracked
--   alongside its RC, Insurance, Permit, Fitness and Pollution documents.
--   Until this runs, saving a Tax document fails with a check-constraint error.
-- ============================================================================

alter table public.documents drop constraint if exists documents_doc_type_check;

alter table public.documents
  add constraint documents_doc_type_check
  check (doc_type in ('rc','insurance','pollution','fitness','permit','tax'));
