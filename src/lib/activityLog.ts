import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'activity_logs';

type ActivityAction = 'login' | 'logout' | 'profile_update' | 'login_failed' | string;

// Insert raw activity row; writes JSONB to details
export async function logActivityRaw(
  supabase: SupabaseClient,
  user_id: string | null | undefined,
  action: ActivityAction,
  details: Record<string, any> = {},
  target_user_id?: string
) {
  if (!user_id) return;

  const payload = {
    user_id,
    action,
    details, // JSONB column in DB
    target_user_id,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };

  const { error } = await supabase.from(TABLE).insert(payload);
  if (error) {
    console.error('Activity log insert failed:', { action, user_id, error: error.message });
  } else {
    console.debug('Activity log insert ok:', { action, user_id });
  }
}

// Convenience: use current session user automatically.
export async function logActivity(
  supabase: SupabaseClient,
  action: ActivityAction,
  details: Record<string, any> = {},
  target_user_id?: string
) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  await logActivityRaw(supabase, uid, action, details, target_user_id);
}

// Sign in with password and log 'login' on success.
export async function signInWithPasswordLog(
  supabase: SupabaseClient,
  params: { email: string; password: string }
) {
  const res = await supabase.auth.signInWithPassword(params);

  if (!res.error && res.data.user) {
    await logActivityRaw(supabase, res.data.user.id, 'login', {
      message: 'User signed in',
      email: params.email,
      source: 'web',
    });
    return res;
  }

  if (res.error) {
    // Optional: log failed login if a session exists
    try {
      const { data: current } = await supabase.auth.getUser();
      const uid = current?.user?.id;
      if (uid) {
        await logActivityRaw(supabase, uid, 'login_failed', {
          message: res.error.message,
          email: params.email,
        });
      }
    } catch {
      // no session; skip
    }
  }

  return res;
}

// Sign out and log 'logout' before terminating session.
export async function signOutWithLog(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (uid) {
    await logActivityRaw(supabase, uid, 'logout', { message: 'User signed out' });
  }
  return supabase.auth.signOut();
}

// Update current user's profile then log 'profile_update'.
export async function updateProfileWithLog(
  supabase: SupabaseClient,
  updates: Record<string, any>
) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error('Not signed in');

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (!error) {
    await logActivityRaw(
      supabase,
      user.id,
      'profile_update',
      { updated_fields: Object.keys(updates) },
      user.id
    );
  }
  return { error };
}
