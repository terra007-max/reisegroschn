-- ─────────────────────────────────────────────────────────────────────────────
-- ReiseGroschn — Supabase Database Schema
-- Austrian Travel Expense (Reisekosten) SaaS — 2025/2026
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type user_role as enum ('USER', 'ADMIN');
create type trip_status as enum ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
create type expense_type as enum ('TAGGELD', 'MILEAGE', 'MEAL_DEDUCTION', 'RECEIPT');
create type vat_rate as enum ('0', '10', '13', '20');

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users via foreign key.

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null,
  email               text not null unique,
  role                user_role not null default 'USER',
  -- Kollektivvertrag daily rate; defaults to statutory €30
  kv_daily_rate       numeric(10, 2) not null default 30.00,
  -- Year-to-date mileage; reset to 0 each calendar year via scheduled function
  ytd_mileage_km      integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- RLS: Users can read/update their own profile; admins can read all.
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'ADMIN'
    )
  );

-- ─── Trips ───────────────────────────────────────────────────────────────────

create table public.trips (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references public.profiles(id) on delete cascade,
  destination                     text not null,
  start_time                      timestamptz not null,
  end_time                        timestamptz not null,
  distance_km                     integer not null default 0,
  meals_provided                  smallint not null default 0 check (meals_provided between 0 and 2),
  status                          trip_status not null default 'DRAFT',
  -- Calculated fields (stored for audit / BAO compliance after approval)
  calculated_taggeld_gross        numeric(10, 2),
  calculated_taggeld_net          numeric(10, 2),
  calculated_mileage_payout       numeric(10, 2),
  calculated_total_tax_free       numeric(10, 2),
  calculated_total_taxable        numeric(10, 2),
  -- 5/15-day rule tracking
  consecutive_days_at_destination integer not null default 1,
  total_days_this_year            integer not null default 1,
  is_secondary_workplace          boolean not null default false,
  -- Approval metadata (BAO audit trail)
  approved_by                     uuid references public.profiles(id),
  approved_at                     timestamptz,
  rejection_reason                text,
  notes                           text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),

  constraint end_after_start check (end_time > start_time)
);

-- RLS: Users manage own trips; admins can approve/reject all.
alter table public.trips enable row level security;

create policy "Users can view own trips"
  on public.trips for select
  using (auth.uid() = user_id);

create policy "Users can insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own DRAFT/PENDING trips"
  on public.trips for update
  using (auth.uid() = user_id and status in ('DRAFT', 'PENDING'));

create policy "Admins can view all trips"
  on public.trips for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "Admins can update trip status"
  on public.trips for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- ─── Expense Lines ────────────────────────────────────────────────────────────

create table public.expense_lines (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  type        expense_type not null,
  amount      numeric(10, 2) not null,
  vat_rate    vat_rate not null default '0',
  description text,
  created_at  timestamptz not null default now()
);

alter table public.expense_lines enable row level security;

create policy "Users can manage expense lines on own trips"
  on public.expense_lines for all
  using (
    exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

create policy "Admins can view all expense lines"
  on public.expense_lines for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- ─── Receipts ─────────────────────────────────────────────────────────────────

create table public.receipts (
  id                uuid primary key default gen_random_uuid(),
  expense_line_id   uuid not null references public.expense_lines(id) on delete cascade,
  -- Supabase Storage path (e.g. "receipts/user-id/trip-id/filename.jpg")
  storage_path      text not null,
  original_amount   numeric(10, 2),
  -- OCR-extracted data (nullable; filled by tesseract.js server action)
  ocr_extracted_amount  numeric(10, 2),
  ocr_extracted_date    date,
  ocr_raw_text          text,
  created_at        timestamptz not null default now()
);

alter table public.receipts enable row level security;

create policy "Users can manage receipts on own trips"
  on public.receipts for all
  using (
    exists (
      select 1
      from public.expense_lines el
      join public.trips t on t.id = el.trip_id
      where el.id = expense_line_id and t.user_id = auth.uid()
    )
  );

-- ─── Triggers: updated_at ─────────────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.handle_updated_at();

-- ─── Trigger: New User → Create Profile ───────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Unbekannt'),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Trigger: Immutability on APPROVED trips (BAO §131) ───────────────────────

create or replace function public.prevent_approved_trip_mutation()
returns trigger language plpgsql as $$
begin
  if old.status = 'APPROVED' and new.status = 'APPROVED' then
    -- Allow only the approved_by / approved_at fields to be set once
    if (
      old.destination != new.destination or
      old.start_time != new.start_time or
      old.end_time != new.end_time or
      old.distance_km != new.distance_km or
      old.meals_provided != new.meals_provided
    ) then
      raise exception 'Approved trips are immutable per BAO §131.';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_trip_immutability
  before update on public.trips
  for each row execute function public.prevent_approved_trip_mutation();

-- ─── Storage Bucket ───────────────────────────────────────────────────────────
-- Run this separately in the Supabase Dashboard → Storage, or via the API.
-- insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);
