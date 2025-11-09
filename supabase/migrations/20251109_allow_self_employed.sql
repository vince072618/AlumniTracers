-- Migration: allow 'Self-employed' in employment_status check

-- Drop existing check constraint if present and recreate with additional allowed value
ALTER TABLE user_profile_questions
  DROP CONSTRAINT IF EXISTS user_profile_questions_employment_status_check;

ALTER TABLE user_profile_questions
  ADD CONSTRAINT user_profile_questions_employment_status_check CHECK (employment_status IN ('Employed', 'Unemployed', 'Self-employed'));

-- NOTE: employment_type remains restricted to ('Private','Government'). We store NULL for self-employed users.
