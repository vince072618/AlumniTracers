import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/Auth/AuthPage';
import AuthCallback from './components/Auth/AuthCallback';
import ResetPasswordForm from './components/Auth/ResetPasswordForm';
import ForgotPasswordForm from './components/Auth/ForgotPasswordForm';
import Dashboard from './components/Dashboard/Dashboard';
import NotAlumniNotice from './pages/NotAlumniNotice';
import DeleteAccountRequest from './components/Profile/DeleteAccountRequest';
import { supabase } from './lib/supabase';

function BlockNotAlumni({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<'checking'|'allow'|'blocked'>('checking');

  React.useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const id = u.user?.id;
        if (!id) { setState('blocked'); return; }
        const { data } = await supabase.from('profiles').select('role').eq('id', id).single();
        const blocked = data?.role === 'not_alumni';
        setState(blocked ? 'blocked' : 'allow');
        if (blocked) {
          try { if (typeof window !== 'undefined') window.location.href = '/not-alumni'; } catch {}
        }
      } catch {
        setState('allow');
      }
    })();
  }, []);

  if (state === 'checking') return null;
  return <>{children}</>;
}

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Handle auth callback route
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  // Handle password reset route
  if (window.location.pathname === '/auth/reset-password') {
    return <ResetPasswordForm />;
  }

  // Handle forgot password route
  if (window.location.pathname === '/auth/forgot-password') {
    return (
      <div className="min-h-screen auth-root auth-bg flex items-center justify-center px-4 py-6">
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <div className="w-full max-w-4xl relative z-20 flex items-start justify-center pt-20 sm:pt-24 md:pt-28 lg:pt-32 auth-card-wrapper">
          <ForgotPasswordForm onBackToLogin={() => { window.location.href = '/'; }} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Handle not-alumni notice route
  if (window.location.pathname === '/not-alumni') {
    return <NotAlumniNotice />;
  }

  // Handle account deletion request route
  if (window.location.pathname === '/request-deletion') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-3xl">
          <DeleteAccountRequest />
        </div>
      </div>
    );
  }

  return isAuthenticated ? (
    <BlockNotAlumni>
      <Dashboard />
    </BlockNotAlumni>
  ) : (
    <AuthPage />
  );
};

function App() {
  // Register service worker for PWA
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }
  }, []);

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;