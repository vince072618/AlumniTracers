-- Table: user_profile_questions
create table if not exists user_profile_questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,

  country text,
  region text,
  province text,
  skills text,

  employment_status text check (employment_status in ('Employed', 'Unemployed')),

  -- ✅ New fields
  job_related_course boolean,  -- Yes/No question
  received_award boolean,      -- Yes/No question
  award_details text,          -- Specify award/s if received_award = true

  employment_type text check (employment_type in ('Private', 'Government')),
  contract_type text check (
    contract_type in (
      'Regular', 'Contractual', 'Job Order', 'Casual'
    )
  ),

  created_at timestamp default now()
);

-- Optional index for lookup by user_id
create unique index if not exists user_profile_questions_user_id_idx on user_profile_questions(user_id);

-- Enable RLS
alter table user_profile_questions enable row level security;

-- ✅ Policies for individual user access
create policy "Allow insert own questions" on user_profile_questions
  for insert with check (auth.uid() = user_id);

create policy "Allow select own questions" on user_profile_questions
  for select using (auth.uid() = user_id);

create policy "Allow update own questions" on user_profile_questions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Optional delete by owner
-- create policy "Allow delete own questions" on user_profile_questions
--   for delete using (auth.uid() = user_id);

-- ✅ Ensure one record per user (for your “one account per alumni” logic)
alter table user_profile_questions
  add constraint unique_user_profile unique (user_id);

-- ✅ Updated View for admin readability
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
  q.job_related_course,
  q.received_award,
  q.award_details,
  q.employment_type,
  q.contract_type,
  q.created_at
from user_profile_questions q
left join profiles p on p.id = q.user_id;
