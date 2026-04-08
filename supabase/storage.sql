-- ─────────────────────────────────────────────────────────────────────────────
-- ReiseGroschn — Supabase Storage Configuration
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Create the private receipts bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,          -- private: only accessible via signed URLs
  10485760,       -- 10 MB max per file
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/tiff',
    'image/bmp'
  ]
)
on conflict (id) do nothing;

-- ─── Storage RLS Policies ─────────────────────────────────────────────────────

-- Users can upload to their own folder: receipts/{userId}/{tripId}/...
create policy "Users can upload own receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Users can read their own receipts
create policy "Users can read own receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Users can delete their own receipts
create policy "Users can delete own receipts"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Admins can read all receipts
create policy "Admins can read all receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'ADMIN'
    )
  );
