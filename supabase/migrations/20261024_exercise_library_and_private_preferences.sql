-- PROPOSAL ONLY: do not apply until reviewed with the owner.
-- Shared canonical catalogue is read-only to authenticated clients.
-- Personal aliases, custom exercises, overrides and profile/preferences are owner-scoped.

begin;

create table if not exists public.exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique check (canonical_key = lower(trim(canonical_key)) and canonical_key <> ''),
  canonical_name text not null check (length(trim(canonical_name)) > 0),
  category text,
  equipment text[] not null default '{}',
  is_active boolean not null default true,
  catalog_version integer not null default 1 check (catalog_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_catalog_muscle_weights (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_catalog(id) on delete cascade,
  muscle_key text not null check (muscle_key = lower(trim(muscle_key)) and muscle_key <> ''),
  role text not null check (role in ('primary','secondary')),
  weight numeric(4,3) not null check (weight > 0 and weight <= 1),
  unique (exercise_id, muscle_key),
  check ((role = 'primary' and weight >= 0.5) or (role = 'secondary' and weight < 0.5))
);

create table if not exists public.user_exercise_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  canonical_exercise_id uuid references public.exercise_catalog(id) on delete set null,
  custom_key text not null check (custom_key = lower(trim(custom_key)) and custom_key <> ''),
  display_name text not null check (length(trim(display_name)) > 0),
  aliases text[] not null default '{}',
  is_custom boolean not null default false,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, custom_key)
);

create table if not exists public.user_exercise_muscle_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_preference_id uuid not null references public.user_exercise_preferences(id) on delete cascade,
  muscle_key text not null check (muscle_key = lower(trim(muscle_key)) and muscle_key <> ''),
  role text not null check (role in ('primary','secondary')),
  weight numeric(4,3) not null check (weight > 0 and weight <= 1),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_preference_id, muscle_key),
  check ((role = 'primary' and weight >= 0.5) or (role = 'secondary' and weight < 0.5))
);

create table if not exists public.user_training_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  weight_unit text not null default 'kg' check (weight_unit in ('kg','lb')),
  distance_unit text not null default 'km' check (distance_unit in ('km','mi')),
  theme text not null default 'system' check (theme in ('system','light','dark')),
  locale text not null default 'en' check (locale in ('en','es')),
  updated_at timestamptz not null default now()
);

-- Typed profile fields used by nutrition/training calculations; no auth tokens or provider secrets here.
create table if not exists public.user_nutrition_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  age_years smallint check (age_years between 13 and 120),
  height_cm numeric(5,2) check (height_cm between 80 and 250),
  activity_level text check (activity_level in ('sedentary','light','moderate','high','very_high')),
  goal_type text check (goal_type in ('fat_loss','maintenance','recomposition','muscle_gain','custom')),
  goal_weight_kg numeric(5,2) check (goal_weight_kg between 25 and 350),
  protein_pct numeric(5,2) check (protein_pct between 0 and 100),
  carbohydrate_pct numeric(5,2) check (carbohydrate_pct between 0 and 100),
  fat_pct numeric(5,2) check (fat_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  check (protein_pct is null or carbohydrate_pct is null or fat_pct is null or abs(protein_pct + carbohydrate_pct + fat_pct - 100) < 0.02)
);

-- Reuse nutrition_targets for typed kcal/macronutrient targets; keep its existing schema intact.
create index if not exists exercise_catalog_active_name_idx on public.exercise_catalog (is_active, canonical_name);
create index if not exists exercise_catalog_muscle_weights_exercise_idx on public.exercise_catalog_muscle_weights (exercise_id, role);
create index if not exists user_exercise_preferences_owner_updated_idx on public.user_exercise_preferences (user_id, updated_at desc);
create index if not exists user_exercise_muscle_weights_owner_exercise_idx on public.user_exercise_muscle_weights (user_id, exercise_preference_id);

alter table public.exercise_catalog enable row level security;
alter table public.exercise_catalog_muscle_weights enable row level security;
alter table public.user_exercise_preferences enable row level security;
alter table public.user_exercise_muscle_weights enable row level security;
alter table public.user_training_preferences enable row level security;
alter table public.user_nutrition_profiles enable row level security;

-- Remove only policies with these migration-owned names, allowing repeatable review/test runs.
drop policy if exists exercise_catalog_authenticated_read on public.exercise_catalog;
create policy exercise_catalog_authenticated_read on public.exercise_catalog
  for select to authenticated using (is_active = true);

drop policy if exists exercise_catalog_muscles_authenticated_read on public.exercise_catalog_muscle_weights;
create policy exercise_catalog_muscles_authenticated_read on public.exercise_catalog_muscle_weights
  for select to authenticated using (exists (
    select 1 from public.exercise_catalog c where c.id = exercise_id and c.is_active = true
  ));

drop policy if exists user_exercise_preferences_owner_all on public.user_exercise_preferences;
create policy user_exercise_preferences_owner_all on public.user_exercise_preferences
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_exercise_muscle_weights_owner_all on public.user_exercise_muscle_weights;
create policy user_exercise_muscle_weights_owner_all on public.user_exercise_muscle_weights
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.user_exercise_preferences p
    where p.id = exercise_preference_id and p.user_id = (select auth.uid())
  ));

drop policy if exists user_training_preferences_owner_all on public.user_training_preferences;
create policy user_training_preferences_owner_all on public.user_training_preferences
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_nutrition_profiles_owner_all on public.user_nutrition_profiles;
create policy user_nutrition_profiles_owner_all on public.user_nutrition_profiles
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Client roles may read the shared catalogue, but only trusted backend/admin tooling may write it.
revoke all on public.exercise_catalog, public.exercise_catalog_muscle_weights from anon, authenticated;
grant select on public.exercise_catalog, public.exercise_catalog_muscle_weights to authenticated;
revoke all on public.user_exercise_preferences, public.user_exercise_muscle_weights,
  public.user_training_preferences, public.user_nutrition_profiles from anon;
grant select, insert, update, delete on public.user_exercise_preferences,
  public.user_exercise_muscle_weights, public.user_training_preferences,
  public.user_nutrition_profiles to authenticated;

commit;
