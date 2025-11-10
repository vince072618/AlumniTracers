import { supabase } from './supabase';
import { AccountDeletionRequest, DeletionDecision } from '../types';
import { ActivityLogger } from './activityLogger';

// Submit a new deletion request for the current user
export async function submitDeletionRequest(reason: string): Promise<AccountDeletionRequest> {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('Not authenticated');

  // Prevent duplicate pending via DB unique index; but fetch to provide nicer error
  const { data: existing, error: existingErr } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingErr && (existingErr as any).code !== 'PGRST116') {
    // Ignore not found, throw other errors
    throw existingErr;
  }

  if (existing && existing.id) {
    throw new Error('You already have a pending deletion request.');
  }

  const { data, error } = await supabase
    .from('account_deletion_requests')
    .insert({ user_id: user.id, reason })
    .select('*')
    .single();

  if (error) throw error;

  // Log activity (best effort)
  try { await ActivityLogger.logAccountDeletionRequested(reason); } catch {}

  return data as unknown as AccountDeletionRequest;
}

// Get current user's requests (newest first)
export async function getMyDeletionRequests(): Promise<AccountDeletionRequest[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as AccountDeletionRequest[];
}

// Admin: list requests, default to pending first
export async function adminListDeletionRequests(status?: 'pending' | 'approved' | 'denied'): Promise<AccountDeletionRequest[]> {
  const query = supabase
    .from('account_deletion_requests')
    .select('*');

  if (status) query.eq('status', status);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AccountDeletionRequest[];
}

// Admin: decide on a request
export async function adminDecideDeletionRequest(
  requestId: string,
  decision: DeletionDecision,
  note?: string
): Promise<AccountDeletionRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const patch = {
    status: decision,
    decided_by: user.id,
    decided_at: new Date().toISOString(),
    decision_note: note || null,
  };

  const { data, error } = await supabase
    .from('account_deletion_requests')
    .update(patch)
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw error;

  // Log activity (best effort)
  try {
    if (decision === 'approved') {
      await ActivityLogger.logAccountDeletionApproved(data.user_id, note);
    } else {
      await ActivityLogger.logAccountDeletionDenied(data.user_id, note);
    }
  } catch {}

  return data as unknown as AccountDeletionRequest;
}
