import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info, Loader2, XCircle, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AccountDeletionRequest } from '../../types';
import { getMyDeletionRequests, submitDeletionRequest } from '../../lib/accountDeletionRequests';

const StatusPill: React.FC<{ status: AccountDeletionRequest['status'] }> = ({ status }) => {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
  if (status === 'pending') return <span className={`${base} bg-yellow-100 text-yellow-800`}><Clock size={12} /> Pending</span>;
  if (status === 'approved') return <span className={`${base} bg-green-100 text-green-800`}><CheckCircle2 size={12} /> Approved</span>;
  return <span className={`${base} bg-red-100 text-red-800`}><XCircle size={12} /> Denied</span>;
};

const DeleteAccountRequest: React.FC = () => {
  // Access context to ensure component only renders for authenticated users
  // (No direct need for user data beyond auth presence at this time.)
  const { user } = useAuth();
  const [reason, setReason] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>('');
  const [success, setSuccess] = React.useState<string>('');
  const [requests, setRequests] = React.useState<AccountDeletionRequest[]>([]);

  const pending = React.useMemo(() => requests.find(r => r.status === 'pending'), [requests]);

  const load = React.useCallback(async () => {
    try {
      setError('');
      const data = await getMyDeletionRequests();
      setRequests(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load requests');
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for your request.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const created = await submitDeletionRequest(reason.trim());
      setRequests(prev => [created, ...prev]);
      setSuccess('Your request has been submitted. Our admins will review it shortly.');
      setReason('');
    } catch (e: any) {
      setError(e?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null; // shouldn't happen inside authenticated dashboard
  }

  const schemaMissing = React.useMemo(() => {
    const msg = (error || '').toLowerCase();
    return msg.includes("could not find the table") && msg.includes('account_deletion_requests');
  }, [error]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Delete Account Request</h3>
          {pending && <StatusPill status={pending.status} />}
        </div>

        <p className="text-sm text-gray-600 mb-4">
          You can request to have your account removed from the alumni system. An admin will review your request before any action is taken.
        </p>

        {error && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertTriangle size={14} />
              <span>{schemaMissing ? 'This feature isn\'t ready yet. An admin must run the database migration to create the account_deletion_requests table.' : error}</span>
            </div>
            {schemaMissing && (
              <p className="text-xs text-gray-600">Contact your administrator to apply the migration in Supabase (see supabase/migrations/20251110_account_deletion_requests.sql). Once applied, refresh this page.</p>
            )}
          </div>
        )}
        {success && (
          <div className="mb-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            <CheckCircle2 size={14} />
            <span>{success}</span>
          </div>
        )}

        {pending ? (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 text-yellow-600" />
              <div>
                <p className="text-sm text-yellow-800">
                  You already have a pending request submitted on {new Date(pending.created_at).toLocaleString()}.
                </p>
                <p className="mt-1 text-sm text-yellow-800">
                  Reason: <span className="italic">{pending.reason}</span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for deletion <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                disabled={schemaMissing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="Please explain why you want your account deleted"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !reason.trim() || schemaMissing}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Send className="mr-2" size={16} />}
                Submit Request
              </button>
            </div>
          </form>
        )}

        {requests.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Your previous requests</h4>
            <div className="space-y-2">
              {requests.map(req => (
                <div key={req.id} className="flex items-start justify-between border rounded-md p-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <StatusPill status={req.status} />
                      <span>Submitted {new Date(req.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Reason: <span className="italic">{req.reason}</span></p>
                    {req.decision_note && (
                      <p className="text-xs text-gray-500 mt-1">Note: {req.decision_note}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {req.decided_at && <div>Decided: {new Date(req.decided_at).toLocaleString()}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeleteAccountRequest;
