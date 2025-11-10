-- Migration: account_deletion_requests
-- Creates table to allow alumni to request account deletion with admin review

-- Extension requirement (if not already present) for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  decided_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Maintain updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_deletion_requests_updated_at ON public.account_deletion_requests;
CREATE TRIGGER account_deletion_requests_updated_at
BEFORE UPDATE ON public.account_deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Unique pending request per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_deletion_requests_user_pending
  ON public.account_deletion_requests(user_id)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Basic policies
-- Alumni can insert their own request
CREATE POLICY IF NOT EXISTS alumni_insert_own_deletion_request ON public.account_deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Alumni can view their own requests; Admin can view all
CREATE POLICY IF NOT EXISTS select_deletion_requests ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can update (approve/deny)
CREATE POLICY IF NOT EXISTS admin_update_deletion_requests ON public.account_deletion_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Alumni cannot delete directly; Only allow admin cleanup if needed
CREATE POLICY IF NOT EXISTS admin_delete_deletion_requests ON public.account_deletion_requests
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- (Optional) Future: trigger to actually anonymize/delete account after approval handled by backend job
