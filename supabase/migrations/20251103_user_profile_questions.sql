-- Table: user_profile_questions
create table if not exists user_profile_questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  country text,
  region text,
  province text,
  skills text,
  employment_status text check (employment_status in ('Employed', 'Unemployed')),
  created_at timestamp default now()
);

-- Optional index for lookup by user_id
create unique index if not exists user_profile_questions_user_id_idx on user_profile_questions(user_id);

-- If you enable Row Level Security (RLS) in Supabase, add policies so authenticated users
-- can insert/select/update only their own rows. Run these statements after creating the table.
-- Note: If you do NOT use RLS, you can skip the following statements.

-- enable RLS on the table
alter table user_profile_questions enable row level security;

-- Allow users to insert a row where user_id = their auth.uid()
create policy "Allow insert own questions" on user_profile_questions
  for insert with check (auth.uid() = user_id);

-- Allow users to select only their own rows
create policy "Allow select own questions" on user_profile_questions
  for select using (auth.uid() = user_id);

-- Allow users to update only their own rows
create policy "Allow update own questions" on user_profile_questions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Optionally allow delete by owner (uncomment if desired)
-- create policy "Allow delete own questions" on user_profile_questions
--   for delete using (auth.uid() = user_id);

-- Create a convenience VIEW that shows the user's name (from profiles) alongside their answers.
-- This is useful for Supabase table/viewer or admin queries so you see a readable name
-- instead of only the raw user_id UUID.
create or replace view user_profile_questions_with_names as
select
  q.id as question_id,
  q.user_id,
  p.first_name,
  p.last_name,
  q.country,
  q.region,
  q.province,
  q.skills,
  q.employment_status,
  q.created_at
from user_profile_questions q
left join profiles p on p.id = q.user_id;

