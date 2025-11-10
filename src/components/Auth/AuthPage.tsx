import React, { useState } from 'react';
import { X } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import PreRegisterGreeting from './PreRegisterGreeting';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showGreeting, setShowGreeting] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const loginVisible = isLogin && !showGreeting;
  const registerVisible = !isLogin && !showGreeting;

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const msg = localStorage.getItem('account_blocked_notice');
        if (msg) {
          setBlockedNotice(msg);
          localStorage.removeItem('account_blocked_notice');
        }
      }
    } catch {}
  }, []);

  // Auto-dismiss after a few seconds (still dismissible manually)
  React.useEffect(() => {
    if (!blockedNotice) return;
    const t = setTimeout(() => setBlockedNotice(null), 10000);
    return () => clearTimeout(t);
  }, [blockedNotice]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-6 sm:py-8 relative overflow-hidden auth-root auth-bg"
    >
  <div className="absolute inset-0 bg-black/40" aria-hidden />

      {/* Hero title - visible behind the auth card but above the overlay */}
      {(loginVisible || showGreeting) && (
  <div className="absolute inset-x-0 top-2 sm:top-4 md:top-6 lg:top-8 xl:top-10 pointer-events-none z-30 flex justify-center auth-hero">
          <div className="max-w-5xl text-center px-4">
            {/* Large, responsive hero that scales for mobile and desktop. Reduced max size so it doesn't overlap the card on large screens. */}
            <h1
              className="font-extrabold text-white drop-shadow-lg leading-tight break-words text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
            >
              Northern Bukidnon State College
            </h1>
            <p className="text-white/80 italic text-xs sm:text-sm md:text-base mt-1">
              Creando futura, Transformationis Vitae, Ductae a Deo
            </p>
            {blockedNotice && (
              <div className="mt-3 flex justify-center">
                <div className="relative pointer-events-auto rounded-md bg-white/95 text-gray-900 shadow-md ring-1 ring-white/60 backdrop-blur-sm px-3 py-2 inline-flex items-start gap-2 max-w-xl text-left">
                  <span className="text-xs sm:text-sm leading-relaxed">{blockedNotice}</span>
                  <button
                    aria-label="Dismiss notice"
                    className="absolute top-1 right-1 p-1 rounded hover:bg-black/5 text-gray-700 transition"
                    onClick={() => setBlockedNotice(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


  <div className={`w-full max-w-4xl relative z-20 flex ${registerVisible ? 'items-center' : 'items-start'} justify-center min-h-[60vh] ${registerVisible ? '' : 'pt-20 sm:pt-24 md:pt-28 lg:pt-32'} auth-card-wrapper`}>
        {showGreeting ? (
          <PreRegisterGreeting
            onNext={() => {
              setShowGreeting(false);
              setIsLogin(false);
              try { if (typeof window !== 'undefined') sessionStorage.setItem('reg_greeting_seen', '1'); } catch {}
            }}
            onCancel={() => {
              setShowGreeting(false);
              setIsLogin(true);
            }}
          />
        ) : isLogin ? (
          <LoginForm
            onSwitchToRegister={() => {
              // Always show the preregistration greeting before taking user to the Register form
              setShowGreeting(true);
            }}
          />
        ) : (
          <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </div>
    </div>
  );
};

export default AuthPage;