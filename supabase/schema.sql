-- ============================================================================
-- Transport Management System — Database Schema
-- Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS guards.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Branches -------------------------------------------------------------------
create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- Seed the two branches (idempotent)
insert into public.branches (name) values ('Lucknow') on conflict (name) do nothing;
insert into public.branches (name) values ('Ghaziabad') on conflict (name) do nothing;

-- Profiles (1:1 with auth.users) --------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        text not null default 'staff' check (role in ('admin','staff')),
  branch_id   uuid references public.branches(id) on delete set null,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Drivers --------------------------------------------------------------------
create table if not exists public.drivers (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id) on delete restrict,
  name            text not null,
  phone           text,
  license_number  text,
  license_expiry  date,
  address         text,
  monthly_salary  numeric(12,2) not null default 0,
  status          text not null default 'active' check (status in ('active','inactive')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Trucks ---------------------------------------------------------------------
create table if not exists public.trucks (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id) on delete restrict,
  vehicle_number  text not null,
  truck_type      text not null default 'company' check (truck_type in ('company','rented')),
  owner_name      text,           -- rented trucks
  owner_phone     text,           -- rented trucks
  make_model      text,
  capacity_tons   numeric(10,2),
  status          text not null default 'active' check (status in ('active','inactive')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (branch_id, vehicle_number)
);

-- Documents (RC / Insurance / Pollution / Fitness / Permit) ------------------
-- Each renewal is a NEW row; is_current flags the active one (history preserved).
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  truck_id    uuid not null references public.trucks(id) on delete cascade,
  branch_id   uuid not null references public.branches(id) on delete restrict,
  doc_type    text not null check (doc_type in ('rc','insurance','pollution','fitness','permit')),
  doc_number  text,
  issue_date  date,
  expiry_date date not null,
  file_url    text,               -- storage object path inside the 'documents' bucket
  file_name   text,
  notes       text,
  is_current  boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Dispatches -----------------------------------------------------------------
create table if not exists public.dispatches (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id) on delete restrict,
  dispatch_date   date not null default current_date,
  driver_id       uuid references public.drivers(id) on delete set null,
  driver_name     text not null,
  truck_id        uuid references public.trucks(id) on delete set null,
  vehicle_number  text not null,
  from_location   text not null,
  to_location     text not null,
  fuel_litres     numeric(10,2) not null default 0,
  fuel_cost       numeric(12,2) not null default 0,
  advance_amount  numeric(12,2) not null default 0,
  misc_amount     numeric(12,2) not null default 0,
  remarks         text,
  truck_type      text not null default 'company' check (truck_type in ('company','rented')),
  owner_details   text,           -- rented trucks
  rent_amount     numeric(12,2) not null default 0,
  status          text not null default 'completed' check (status in ('pending','in_transit','completed','cancelled')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Salaries (drivers & staff) -------------------------------------------------
create table if not exists public.salaries (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete restrict,
  person_type   text not null check (person_type in ('driver','staff')),
  driver_id     uuid references public.drivers(id) on delete set null,
  staff_id      uuid references public.profiles(id) on delete set null,
  person_name   text not null,
  month         date not null,    -- first day of the salary month
  base_salary   numeric(12,2) not null default 0,
  bonus         numeric(12,2) not null default 0,
  deductions    numeric(12,2) not null default 0,
  net_salary    numeric(12,2) generated always as (base_salary + bonus - deductions) stored,
  paid          boolean not null default false,
  paid_date     date,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Audit logs -----------------------------------------------------------------
create table if not exists public.audit_logs (
  id              bigint generated always as identity primary key,
  table_name      text not null,
  record_id       uuid,
  action          text not null check (action in ('INSERT','UPDATE','DELETE')),
  branch_id       uuid,
  changed_by      uuid,
  changed_by_name text,
  old_data        jsonb,
  new_data        jsonb,
  created_at      timestamptz not null default now()
);

-- Indexes --------------------------------------------------------------------
create index if not exists idx_drivers_branch     on public.drivers(branch_id);
create index if not exists idx_trucks_branch       on public.trucks(branch_id);
create index if not exists idx_documents_branch    on public.documents(branch_id);
create index if not exists idx_documents_truck     on public.documents(truck_id);
create index if not exists idx_documents_expiry    on public.documents(expiry_date) where is_current;
create index if not exists idx_dispatches_branch   on public.dispatches(branch_id);
create index if not exists idx_dispatches_date     on public.dispatches(dispatch_date);
create index if not exists idx_salaries_branch     on public.salaries(branch_id);
create index if not exists idx_salaries_month      on public.salaries(month);
create index if not exists idx_audit_branch        on public.audit_logs(branch_id);
create index if not exists idx_audit_created       on public.audit_logs(created_at);

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER → bypass RLS, avoid recursion on profiles)
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.user_branch_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select branch_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Auto-create a profile when an auth user is created (reads user_metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, branch_id, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'staff'),
    nullif(new.raw_user_meta_data->>'branch_id', '')::uuid,
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email     = excluded.email,
        role      = excluded.role,
        branch_id = excluded.branch_id,
        phone     = excluded.phone;
  return new;
end;
$$;

-- Maintain a single current document per (truck, doc_type)
create or replace function public.documents_set_current()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_current then
    update public.documents
       set is_current = false
     where truck_id = new.truck_id
       and doc_type = new.doc_type
       and id <> new.id
       and is_current;
  end if;
  return new;
end;
$$;

-- Generic audit logger
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch uuid;
  v_actor  uuid := auth.uid();
  v_name   text;
begin
  if (tg_op = 'DELETE') then
    v_branch := nullif(to_jsonb(old)->>'branch_id','')::uuid;
  else
    v_branch := nullif(to_jsonb(new)->>'branch_id','')::uuid;
  end if;

  select full_name into v_name from public.profiles where id = v_actor;

  insert into public.audit_logs (
    table_name, record_id, action, branch_id, changed_by, changed_by_name, old_data, new_data
  ) values (
    tg_table_name,
    coalesce(nullif(to_jsonb(new)->>'id','')::uuid, nullif(to_jsonb(old)->>'id','')::uuid),
    tg_op,
    v_branch,
    v_actor,
    v_name,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if (tg_op = 'DELETE') then return old; else return new; end if;
end;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- new auth user → profile
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at
drop trigger if exists trg_profiles_updated   on public.profiles;
create trigger trg_profiles_updated   before update on public.profiles   for each row execute function public.set_updated_at();
drop trigger if exists trg_drivers_updated    on public.drivers;
create trigger trg_drivers_updated    before update on public.drivers    for each row execute function public.set_updated_at();
drop trigger if exists trg_trucks_updated     on public.trucks;
create trigger trg_trucks_updated     before update on public.trucks     for each row execute function public.set_updated_at();
drop trigger if exists trg_documents_updated  on public.documents;
create trigger trg_documents_updated  before update on public.documents  for each row execute function public.set_updated_at();
drop trigger if exists trg_dispatches_updated on public.dispatches;
create trigger trg_dispatches_updated before update on public.dispatches for each row execute function public.set_updated_at();
drop trigger if exists trg_salaries_updated   on public.salaries;
create trigger trg_salaries_updated   before update on public.salaries   for each row execute function public.set_updated_at();

-- documents current flag
drop trigger if exists trg_documents_current on public.documents;
create trigger trg_documents_current
  after insert on public.documents
  for each row execute function public.documents_set_current();

-- audit logging
drop trigger if exists trg_audit_drivers    on public.drivers;
create trigger trg_audit_drivers    after insert or update or delete on public.drivers    for each row execute function public.audit_trigger();
drop trigger if exists trg_audit_trucks     on public.trucks;
create trigger trg_audit_trucks     after insert or update or delete on public.trucks     for each row execute function public.audit_trigger();
drop trigger if exists trg_audit_documents  on public.documents;
create trigger trg_audit_documents  after insert or update or delete on public.documents  for each row execute function public.audit_trigger();
drop trigger if exists trg_audit_dispatches on public.dispatches;
create trigger trg_audit_dispatches after insert or update or delete on public.dispatches for each row execute function public.audit_trigger();
drop trigger if exists trg_audit_salaries   on public.salaries;
create trigger trg_audit_salaries   after insert or update or delete on public.salaries   for each row execute function public.audit_trigger();
drop trigger if exists trg_audit_profiles   on public.profiles;
create trigger trg_audit_profiles   after insert or update or delete on public.profiles   for each row execute function public.audit_trigger();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.branches   enable row level security;
alter table public.profiles   enable row level security;
alter table public.drivers    enable row level security;
alter table public.trucks     enable row level security;
alter table public.documents  enable row level security;
alter table public.dispatches enable row level security;
alter table public.salaries   enable row level security;
alter table public.audit_logs enable row level security;

-- Branches: everyone authenticated can read; only admin writes
drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches for select to authenticated using (true);
drop policy if exists branches_admin_write on public.branches;
create policy branches_admin_write on public.branches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profiles: self-read + admin-read; admin manages
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check (public.is_admin());
drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- Generic branch-scoped policy maker applied to operational tables
do $$
declare t text;
begin
  foreach t in array array['drivers','trucks','documents','dispatches','salaries'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format($f$create policy %1$s_select on public.%1$s for select to authenticated
      using (public.is_admin() or branch_id = public.user_branch_id());$f$, t);

    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format($f$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check (public.is_admin() or branch_id = public.user_branch_id());$f$, t);

    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format($f$create policy %1$s_update on public.%1$s for update to authenticated
      using (public.is_admin() or branch_id = public.user_branch_id())
      with check (public.is_admin() or branch_id = public.user_branch_id());$f$, t);

    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);
    execute format($f$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (public.is_admin() or branch_id = public.user_branch_id());$f$, t);
  end loop;
end $$;

-- Audit logs: admin sees all, staff see their own branch; no direct writes
-- (writes happen only via SECURITY DEFINER trigger which bypasses RLS).
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (public.is_admin() or branch_id = public.user_branch_id());

-- ============================================================================
-- STORAGE (private bucket for document scans)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Objects are stored under "<branch_id>/<truck_id>/<file>"; folder[1] = branch_id.
drop policy if exists documents_storage_select on storage.objects;
create policy documents_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (public.is_admin() or (storage.foldername(name))[1] = public.user_branch_id()::text)
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (public.is_admin() or (storage.foldername(name))[1] = public.user_branch_id()::text)
  );

drop policy if exists documents_storage_update on storage.objects;
create policy documents_storage_update on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (public.is_admin() or (storage.foldername(name))[1] = public.user_branch_id()::text)
  );

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (public.is_admin() or (storage.foldername(name))[1] = public.user_branch_id()::text)
  );

-- ============================================================================
-- DONE. Next: run the seed script (npm run seed) to create the admin + staff.
-- ============================================================================
