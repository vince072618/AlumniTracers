import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

interface AdminVerifyToggleProps {
  userId: string;
  isVerified: boolean;
  onChange?: (next: boolean) => void;
}

// Small admin-only control to set verification status.
// Assumes JWT has role=admin (RLS function will block otherwise).
const AdminVerifyToggle: React.FC<AdminVerifyToggleProps> = ({ userId, isVerified, onChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setLoading(true);
    setError(null);
    const next = !isVerified;
    try {
      const { error: rpcError } = await supabase.rpc('set_alumni_verification', {
        p_user_id: userId,
        p_verified: next,
      });
      if (rpcError) throw rpcError;
      onChange && onChange(next);
    } catch (e: any) {
      setError(e.message || 'Failed to update verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={toggle}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
          isVerified
            ? 'bg-green-600 text-white border-green-700 hover:bg-green-700'
            : 'bg-yellow-500 text-white border-yellow-600 hover:bg-yellow-600'
        } disabled:opacity-50`}
        title={isVerified ? 'Click to mark as unverified' : 'Click to mark as verified'}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isVerified ? (
          <ShieldCheck size={14} />
        ) : (
          <ShieldAlert size={14} />
        )}
        {isVerified ? 'Verified' : 'Mark Verified'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
};

export default AdminVerifyToggle;
