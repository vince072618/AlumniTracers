/*
  # Fix Activity Logs System

  1. New Tables
    - Recreate `activity_logs` table with proper structure
    - Add comprehensive logging for all profile changes

  2. Security
    - Enable RLS on `activity_logs` table
    - Add policies for users to read their own logs
    - Add policy for system to insert logs

  3. Functions
    - Enhanced function to log all profile changes
    - Function to manually log user activities
    - Improved trigger to capture all profile updates

  4. Indexes
    - Add performance indexes for activity logs
*/

-- Drop existing objects if they exist
DROP TRIGGER IF EXISTS log_profile_changes_trigger ON profiles;
DROP FUNCTION IF EXISTS log_profile_changes();
DROP FUNCTION IF EXISTS log_user_activity(uuid, text, text, jsonb, text, text);
DROP TABLE IF EXISTS activity_logs CASCADE;

-- Create activity_logs table
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'login',
    'logout', 
    'profile_update',
    'password_change',
    'registration',
    'email_verification'
  )),
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create enhanced function to log profile changes
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}';
  change_description text := '';
  change_count integer := 0;
BEGIN
  -- Build changes object and description for all possible fields
  IF COALESCE(OLD.first_name, '') != COALESCE(NEW.first_name, '') THEN
    changes := changes || jsonb_build_object('first_name', jsonb_build_object('old', COALESCE(OLD.first_name, ''), 'new', COALESCE(NEW.first_name, '')));
    change_description := change_description || 'First name updated. ';
    change_count := change_count + 1;
  END IF;
  
  IF COALESCE(OLD.last_name, '') != COALESCE(NEW.last_name, '') THEN
    changes := changes || jsonb_build_object('last_name', jsonb_build_object('old', COALESCE(OLD.last_name, ''), 'new', COALESCE(NEW.last_name, '')));
    change_description := change_description || 'Last name updated. ';
    change_count := change_count + 1;
  END IF;
  
  IF COALESCE(OLD.course, '') != COALESCE(NEW.course, '') THEN
    changes := changes || jsonb_build_object('course', jsonb_build_object('old', COALESCE(OLD.course, ''), 'new', COALESCE(NEW.course, '')));
    change_description := change_description || 'Course updated. ';
    change_count := change_count + 1;
  END IF;
  
  IF COALESCE(OLD.graduation_year, 0) != COALESCE(NEW.graduation_year, 0) THEN
    changes := changes || jsonb_build_object('graduation_year', jsonb_build_object('old', OLD.graduation_year, 'new', NEW.graduation_year));
    change_description := change_description || 'Graduation year updated. ';
    change_count := change_count + 1;
  END IF;
  
  IF COALESCE(OLD.current_job, '') != COALESCE(NEW.current_job, '') THEN
    changes := changes || jsonb_build_object('current_job', jsonb_build_object('old', COALESCE(OLD.current_job, ''), 'new', COALESCE(NEW.current_job, '')));
    change_description := change_description || 'Current job updated. ';
    change_count := change_count + 1;
  END IF;
  
  IF COALESCE(OLD.company, '') != COALESCE(NEW.company, '') THEN
    changes := changes || jsonb_build_object('company', jsonb_build_object('old', COALESCE(OLD.company, ''), 'new', COALESCE(NEW.company, '')));
    change_description := change_description || 'Company updated. ';
    change_count := change_count + 1;
  END IF;
  
  IF COALESCE(OLD.location, '') != COALESCE(NEW.location, '') THEN
    changes := changes || jsonb_build_object('location', jsonb_build_object('old', COALESCE(OLD.location, ''), 'new', COALESCE(NEW.location, '')));
    change_description := change_description || 'Location updated. ';
    change_count := change_count + 1;
  END IF;
  
  IF COALESCE(OLD.phone_number, '') != COALESCE(NEW.phone_number, '') THEN
    changes := changes || jsonb_build_object('phone_number', jsonb_build_object('old', COALESCE(OLD.phone_number, ''), 'new', COALESCE(NEW.phone_number, '')));
    change_description := change_description || 'Phone number updated. ';
    change_count := change_count + 1;
  END IF;

  -- Log the changes if any were made
  IF change_count > 0 THEN
    -- Create a more descriptive message
    IF change_count = 1 THEN
      change_description := 'Profile updated: ' || TRIM(change_description);
    ELSE
      change_description := 'Profile updated: ' || change_count::text || ' fields changed - ' || TRIM(change_description);
    END IF;

    INSERT INTO activity_logs (user_id, activity_type, description, metadata, ip_address, user_agent)
    VALUES (
      NEW.id,
      'profile_update',
      change_description,
      changes,
      'server-side',
      'Profile Update Trigger'
    );
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for profile changes
CREATE TRIGGER log_profile_changes_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_profile_changes();

-- Create function to manually log user activities
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id uuid,
  p_activity_type text,
  p_description text,
  p_metadata jsonb DEFAULT '{}',
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO activity_logs (
    user_id,
    activity_type,
    description,
    metadata,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    p_user_id,
    p_activity_type,
    p_description,
    COALESCE(p_metadata, '{}'),
    COALESCE(p_ip_address, 'unknown'),
    COALESCE(p_user_agent, 'unknown'),
    now()
  );
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON activity_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_activity(uuid, text, text, jsonb, text, text) TO authenticated;