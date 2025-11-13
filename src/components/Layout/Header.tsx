import React from 'react';
import { LogOut, Bell, Menu, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  onOpenAnnouncements?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle, onOpenAnnouncements }) => {
  const { user, logout } = useAuth();

  const [unseenCount, setUnseenCount] = React.useState<number>(0);

  const storageKey = React.useMemo(() => `announcements_last_seen_${user?.id || 'anon'}`, [user?.id]);

  const getLastSeen = React.useCallback(() => {
    try {
      const v = localStorage.getItem(storageKey);
      return v ? new Date(v) : new Date(0);
    } catch {
      return new Date(0);
    }
  }, [storageKey]);

  const markAllSeen = React.useCallback(() => {
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
      setUnseenCount(0);
    } catch {}
  }, [storageKey]);

  // Load initial unseen count and subscribe to new announcements
  React.useEffect(() => {
    let mounted = true;
    if (!user) return;

    const loadCount = async () => {
      try {
        const lastSeen = getLastSeen();
        // fetch recent published announcements (limit to 500)
        const { data, error } = await supabase
          .from('announcements')
          .select('id,published_at,created_at')
          .eq('published', true)
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        const rows = (data ?? []) as Array<any>;
        const count = rows.filter(r => {
          const ts = r.published_at || r.created_at;
          if (!ts) return false;
          return new Date(ts) > lastSeen;
        }).length;
        if (mounted) setUnseenCount(count);
      } catch (e) {
        // ignore
      }
    };

    loadCount();

    const ch = supabase
      .channel('announcements-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        try {
          const record = (payload as any).new || (payload as any).record || (payload as any).payload?.record;
          if (!record) return;
          if (!record.published) return; // only care about published ones
          const ts = record.published_at || record.created_at;
          if (!ts) return;
          const lastSeen = getLastSeen();
          if (new Date(ts) > lastSeen) {
            setUnseenCount(c => c + 1);
          }
        } catch (e) {}
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [user, getLastSeen]);

  // Listen for global 'announcements-seen' events (dispatched by Dashboard when user opens the announcements tab)
  React.useEffect(() => {
    const handler = () => markAllSeen();
    try {
      window.addEventListener('announcements-seen', handler as EventListener);
    } catch {}
    return () => {
      try {
        window.removeEventListener('announcements-seen', handler as EventListener);
      } catch {}
    };
  }, [markAllSeen]);

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center space-x-4">
        {/* Mobile menu button */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>

        {/* Logo and App Title */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white">
            <img
              src="/logo.jpeg"
              alt="NBSC Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-blue-900">
            NBSC Alumni Portal
          </h1>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center space-x-4">
        {/* Notification Bell with badge */}
        <div className="relative">
          <button
            onClick={() => {
              if (onOpenAnnouncements) onOpenAnnouncements();
              markAllSeen();
            }}
            className="hidden sm:block p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Notifications"
            aria-label="Open announcements"
          >
            <Bell size={20} />
          </button>
          {unseenCount > 0 && (
            <span className="absolute -top-0 -right-0 translate-x-1/2 -translate-y-1/2 bg-red-600 text-white text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </div>

        {/* User Info and Logout */}
        <div className="flex items-center space-x-3 border-l border-gray-200 pl-4">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="flex items-center gap-2 text-xs text-gray-500">
              Alumni • {user?.email}
              {user?.isVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  <ShieldCheck size={12} /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium" title="Not yet verified by admin">
                  <ShieldAlert size={12} /> Pending
                </span>
              )}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
