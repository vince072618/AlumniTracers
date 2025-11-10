# process-deletion-requests (Supabase Edge Function)

Deletes users from Supabase Auth and anonymizes their profile after an admin approves account deletion requests.

## What it does
- Finds rows in `public.account_deletion_requests` with `status = 'approved'` and `processed_at IS NULL`.
- Calls Auth Admin API to delete the user.
- Soft-anonymizes their `profiles` row (keeps row for audit/log links).
- Marks the request with `processed_at` or `process_error`.

## Deploy
```powershell
# From repo root
supabase functions deploy process-deletion-requests

# Set secrets (run once)
supabase secrets set DELETION_ADMIN_SECRET=<strong-random-secret>
# Service creds are inherited from project settings; ensure SUPABASE_SERVICE_ROLE_KEY is available to functions
```

## Invoke (manual)
```powershell
# Replace <project-url>
$headers = @{ "x-admin-secret" = "<the-secret-you-set>" }
Invoke-WebRequest -Uri "https://<project-ref>.functions.supabase.co/process-deletion-requests" -Headers $headers -Method POST
```

## Schedule (recommended)
Use Supabase Scheduler to call this function every few minutes with the `x-admin-secret` header.

## Notes
- Requires the migration `20251111_process_deletion_extension.sql` (adds `processed_at` and `process_error`).
- This function uses the service role key and bypasses RLS; keep the `x-admin-secret` secret.
- Adjust the anonymization payload to fit your compliance needs.
