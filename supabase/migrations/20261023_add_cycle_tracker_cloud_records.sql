-- TrainMei migration: cloud persistence for Cycle Tracker records.
-- Additive only: does not read, rewrite, or delete existing user records.
create table if not exists public.cycle_tracker_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  records jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint cycle_tracker_records_records_is_array check (jsonb_typeof(records) = 'array')
);

alter table public.cycle_tracker_records enable row level security;

-- Re-runnable policy setup for environments where the migration was partially applied.
drop policy if exists "Users can view own cycle tracker records" on public.cycle_tracker_records;
drop policy if exists "Users can insert own cycle tracker records" on public.cycle_tracker_records;
drop policy if exists "Users can update own cycle tracker records" on public.cycle_tracker_records;
drop policy if exists "Users can delete own cycle tracker records" on public.cycle_tracker_records;

create policy "Users can view own cycle tracker records"
  on public.cycle_tracker_records for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert own cycle tracker records"
  on public.cycle_tracker_records for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own cycle tracker records"
  on public.cycle_tracker_records for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Users can delete own cycle tracker records"
  on public.cycle_tracker_records for delete to authenticated
  using (auth.uid() = user_id);
