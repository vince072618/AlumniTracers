import React from 'react';
import { adminListDeletionRequests, adminDecideDeletionRequest } from '../../lib/accountDeletionRequests';
import { AccountDeletionRequest } from '../../types';
import { CheckCircle2, Loader2, XCircle, Filter, StickyNote } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const DeletionRequests: React.FC = () => {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<'pending'|'approved'|'denied'|undefined>('pending');
  const [items, setItems] = React.useState<AccountDeletionRequest[]>([]);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const role = data.user?.user_metadata?.role;
      setIsAdmin(role === 'admin');
    }).finally(() => setLoading(false));
  }, []);

  const load = React.useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const data = await adminListDeletionRequests(statusFilter);
      setItems(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const onDecide = async (id: string, decision: 'approved'|'denied') => {
    const note = window.prompt(`Add an optional note for why this is ${decision}:`);
    try {
      setLoading(true);
      await adminDecideDeletionRequest(id, decision, note || undefined);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update request');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <p className="text-red-700">Access denied. Admins only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Account Deletion Requests</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 flex items-center gap-1"><Filter size={14}/> Filter:</span>
          <select
            value={statusFilter || ''}
            onChange={e => setStatusFilter((e.target.value || undefined) as any)}
            className="border rounded-md px-2 py-1 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="">All</option>
          </select>
          <button onClick={load} className="px-3 py-1 text-sm border rounded-md">Refresh</button>
        </div>
      </div>

      {error && <div className="text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border">
        {loading ? (
          <div className="p-6 flex items-center gap-2 text-gray-600"><Loader2 className="animate-spin" size={16}/> Loading…</div>
        ) : (
          <div className="divide-y">
            {items.length === 0 && (
              <div className="p-6 text-sm text-gray-600">No requests found.</div>
            )}
            {items.map(item => (
              <div key={item.id} className="p-4 flex items-start justify-between">
                <div>
                  <div className="text-sm text-gray-900 font-medium">User: {item.user_id}</div>
                  <div className="text-sm text-gray-700 mt-1">Reason: <span className="italic">{item.reason}</span></div>
                  <div className="text-xs text-gray-500 mt-1">Submitted: {new Date(item.created_at).toLocaleString()}</div>
                  {item.decided_at && (
                    <div className="text-xs text-gray-500">Decided: {new Date(item.decided_at).toLocaleString()}</div>
                  )}
                  {item.decision_note && (
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><StickyNote size={12}/> Note: {item.decision_note}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'pending' ? (
                    <>
                      <button onClick={() => onDecide(item.id, 'approved')} className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700">
                        <CheckCircle2 size={16} className="mr-1"/> Approve
                      </button>
                      <button onClick={() => onDecide(item.id, 'denied')} className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700">
                        <XCircle size={16} className="mr-1"/> Deny
                      </button>
                    </>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${item.status==='approved'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{item.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeletionRequests;
