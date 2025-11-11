-- Migration: add completed_quick_questions to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS completed_quick_questions boolean DEFAULT false;

-- Ensure RLS policy changes are applied by DB admin if needed. This migration only adds the column with a default value of false.
