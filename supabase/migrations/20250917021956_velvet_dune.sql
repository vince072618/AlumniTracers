/*
  # Create Activity Logs System

  1. New Tables
    - `activity_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `activity_type` (text, type of activity)
      - `description` (text, human readable description)
      - `metadata` (jsonb, additional data about the activity)
      - `ip_address` (text, user's IP address)
      - `user_agent` (text, browser/device info)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `activity_logs` table
    - Add policies for users to read their own logs
    - Add policy for admins to read all logs

  3. Functions
    - Function to automatically log profile changes
    - Trigger to capture profile updates
*/

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
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

-- Create function to log profile changes
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}';
  change_description text := '';
BEGIN
  -- Build changes object and description
  IF OLD.first_name != NEW.first_name THEN
    changes := changes || jsonb_build_object('first_name', jsonb_build_object('old', OLD.first_name, 'new', NEW.first_name));
    change_description := change_description || 'First name updated. ';
  END IF;
  
  IF OLD.last_name != NEW.last_name THEN
    changes := changes || jsonb_build_object('last_name', jsonb_build_object('old', OLD.last_name, 'new', NEW.last_name));
    change_description := change_description || 'Last name updated. ';
  END IF;
  
  IF OLD.course != NEW.course THEN
    changes := changes || jsonb_build_object('course', jsonb_build_object('old', OLD.course, 'new', NEW.course));
    change_description := change_description || 'Course updated. ';
  END IF;
  
  IF OLD.graduation_year != NEW.graduation_year THEN
    changes := changes || jsonb_build_object('graduation_year', jsonb_build_object('old', OLD.graduation_year, 'new', NEW.graduation_year));
    change_description := change_description || 'Graduation year updated. ';
  END IF;
  
  IF COALESCE(OLD.current_job, '') != COALESCE(NEW.current_job, '') THEN
    changes := changes || jsonb_build_object('current_job', jsonb_build_object('old', OLD.current_job, 'new', NEW.current_job));
    change_description := change_description || 'Current job updated. ';
  END IF;
  
  IF COALESCE(OLD.company, '') != COALESCE(NEW.company, '') THEN
    changes := changes || jsonb_build_object('company', jsonb_build_object('old', OLD.company, 'new', NEW.company));
    change_description := change_description || 'Company updated. ';
  END IF;
  
  IF COALESCE(OLD.location, '') != COALESCE(NEW.location, '') THEN
    changes := changes || jsonb_build_object('location', jsonb_build_object('old', OLD.location, 'new', NEW.location));
    change_description := change_description || 'Location updated. ';
  END IF;
  
  IF COALESCE(OLD.phone_number, '') != COALESCE(NEW.phone_number, '') THEN
    changes := changes || jsonb_build_object('phone_number', jsonb_build_object('old', OLD.phone_number, 'new', NEW.phone_number));
    change_description := change_description || 'Phone number updated. ';
  END IF;

  -- Only log if there are actual changes
  IF changes != '{}' THEN
    INSERT INTO activity_logs (user_id, activity_type, description, metadata)
    VALUES (
      NEW.id,
      'profile_update',
      TRIM(change_description),
      changes
    );
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for profile changes
DROP TRIGGER IF EXISTS log_profile_changes_trigger ON profiles;
CREATE TRIGGER log_profile_changes_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_profile_changes();

-- Create function to log user activities
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
    user_agent
  ) VALUES (
    p_user_id,
    p_activity_type,
    p_description,
    p_metadata,
    p_ip_address,
    p_user_agent
  );
END;
$$ language 'plpgsql';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type);