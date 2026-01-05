-- Create the table for itinerary items
create table public.honeymoon_itinerary (
  id uuid default gen_random_uuid() primary key,
  day_number int,
  date text,
  time_slot text,
  title text,
  guideline text,
  photo_urls text[], -- Array of strings for multiple photos
  thoughts text,
  google_maps_url text,
  template text default 'classic',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.honeymoon_itinerary enable row level security;

-- Create a policy that allows everyone to read (since it's a shared travel log)
-- You can restrict this if needed
create policy "Enable read access for all users"
on public.honeymoon_itinerary
for select using (true);

-- Create a policy that allows everyone to insert/update/delete (for dev simplicity)
-- WARNING: In a real production app, restrict this to authenticated users!
create policy "Enable write access for all users"
on public.honeymoon_itinerary
for all using (true);

-- Storage Bucket Setup
-- You need to create a bucket named 'honeymoon-photos' in the Supabase Dashboard -> Storage

-- Storage Policies (Run these in SQL Editor if you can't set them in UI)
-- 1. Allow public read access to the bucket
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'honeymoon-photos' );

-- 2. Allow authenticated (and anon for now) uploads
create policy "Public Upload"
on storage.objects for insert
with check ( bucket_id = 'honeymoon-photos' );
