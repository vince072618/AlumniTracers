import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ActivityLogger } from '../../lib/activityLogger';

const AuthCallback: React.FC = () => {
  const { isLoading } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          // Redirect to login with error
          window.location.href = '/';
          return;
        }

        if (data.session) {
          // User is now authenticated, redirect to dashboard
          setTimeout(() => {
            ActivityLogger.logEmailVerification();
          }, 1000);
          window.location.href = '/';
        } else {
          // No session, redirect to login
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        window.location.href = '/';
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Confirming your email...</p>
      </div>
    </div>
  );
};

export default AuthCallback;