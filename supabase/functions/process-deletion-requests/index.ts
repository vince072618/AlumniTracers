// Edge Function: process-deletion-requests
// Scans approved, unprocessed account_deletion_requests, deletes the auth user, and anonymizes profile.
// Invocation: can be scheduled via Supabase Scheduler or manually invoked by an admin.

// Provide a lightweight runtime-safe `serve` shim to avoid a static remote import that may not resolve
// in some TypeScript tooling environments; this uses the edge `fetch` event when available and falls
// back to a dynamic import of the std server at runtime.
function serve(handler: (req: Request) => Promise<Response> | Response) {
  if (typeof addEventListener === 'function') {
    addEventListener('fetch', (event: any) => {
      event.respondWith(handler(event.request));
    });
    return;
  }

  // Fallback: attempt to dynamically import the std server at runtime (works when Deno can fetch)
  (async () => {
    try {
      // @ts-ignore: dynamic import only used at runtime; some tooling cannot resolve remote modules
      const mod = await import('https://deno.land/std@0.224.0/http/server.ts');
      mod.serve(handler);
    } catch (err) {
      throw new Error('serve: no runtime fetch handler available and dynamic import failed: ' + String(err));
    }
  })();
}

interface DeletionRow {
  id: string;
  user_id: string;
  status: string;
  processed_at: string | null;
  process_error: string | null;
}

const json = (body: any, init: ResponseInit = {}) => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json' },
  ...init
});

serve(async (req: Request) => {
  // Basic admin secret check (set this env var in your function config)
  const adminSecret = ((globalThis as any).Deno?.env?.get('DELETION_ADMIN_SECRET')) ?? (typeof process !== 'undefined' ? process.env['DELETION_ADMIN_SECRET'] : undefined);
  if (!adminSecret) {
    return json({ error: 'Function misconfigured: missing DELETION_ADMIN_SECRET' }, { status: 500 });
  }
  const provided = req.headers.get('x-admin-secret');
  if (provided !== adminSecret) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
  const url = ((globalThis as any).Deno?.env?.get('SUPABASE_URL')) ?? (typeof process !== 'undefined' ? process.env['SUPABASE_URL'] : undefined);
  const serviceKey = ((globalThis as any).Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY')) ?? (typeof process !== 'undefined' ? process.env['SUPABASE_SERVICE_ROLE_KEY'] : undefined);
  if (!url || !serviceKey) {
    return json({ error: 'Missing service credentials' }, { status: 500 });
  }

    // Use service key for admin operations
    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    };

    // Fetch approved, unprocessed requests
    const { data: rows, error: fetchErr } = await fetch(`${url}/rest/v1/account_deletion_requests?select=id,user_id,status,processed_at,process_error&status=eq.approved&processed_at=is.null`, { headers }).then(r => r.json().then(data => ({ data, error: r.ok ? null : data })));

    if (fetchErr) {
      return json({ error: 'Failed to fetch requests', details: fetchErr }, { status: 500 });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ processed: 0, message: 'No approved pending deletions.' });
    }

    const results: any[] = [];

    for (const row of rows as DeletionRow[]) {
      try {
        // Delete auth user
        const delRes = await fetch(`${url}/auth/v1/admin/users/${row.user_id}`, {
          method: 'DELETE',
          headers
        });
        if (!delRes.ok) {
          const txt = await delRes.text();
          throw new Error(`Auth delete failed: ${txt}`);
        }

        // Anonymize profile (keep referential integrity for logs)
        const anonPayload = {
          first_name: 'Deleted',
            last_name: 'User',
            email: null,
            course: null,
            current_job: null,
            company: null,
            location: null,
            phone_number: null
        };
        await fetch(`${url}/rest/v1/profiles?id=eq.${row.user_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(anonPayload)
        });

        // Mark processed_at
        await fetch(`${url}/rest/v1/account_deletion_requests?id=eq.${row.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ processed_at: new Date().toISOString(), process_error: null })
        });

        results.push({ id: row.id, user_id: row.user_id, status: 'success' });
      } catch (e) {
        await fetch(`${url}/rest/v1/account_deletion_requests?id=eq.${row.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ process_error: (e as Error).message })
        });
        results.push({ id: row.id, user_id: row.user_id, status: 'error', error: (e as Error).message });
      }
    }

    return json({ processed: results.length, results });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});
