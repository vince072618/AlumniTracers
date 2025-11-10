-- Extend account_deletion_requests to track backend processing
ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS process_error text;

-- Index to quickly find approved, unprocessed requests
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_approved_unprocessed
  ON public.account_deletion_requests(status, processed_at)
  WHERE status='approved' AND processed_at IS NULL;
