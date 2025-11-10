import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import PreRegisterGreeting from './PreRegisterGreeting';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showGreeting, setShowGreeting] = useState(false);
  const loginVisible = isLogin && !showGreeting;
  const registerVisible = !isLogin && !showGreeting;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden auth-root auth-bg"
    >
  <div className="absolute inset-0 bg-black/40" aria-hidden />

      {/* Hero title - visible behind the auth card but above the overlay */}
      {(loginVisible || showGreeting) && (
        <div className="absolute inset-x-0 top-4 sm:top-6 md:top-8 lg:top-10 xl:top-12 pointer-events-none z-30 flex justify-center auth-hero">
          <div className="max-w-5xl text-center px-4">
            {/* Large, responsive hero that scales for mobile and desktop. Reduced max size so it doesn't overlap the card on large screens. */}
            <h1
              className="font-extrabold text-white drop-shadow-lg leading-tight break-words"
              style={{ fontSize: 'clamp(28px, 4.5vw, 56px)' }}
            >
              Northern Bukidnon State College
            </h1>
            <p className="text-white/80 italic" style={{ fontSize: 'clamp(12px, 2.2vw, 18px)' }}>
              Creando futura, Transformationis Vitae, Ductae a Deo
            </p>
          </div>
        </div>
      )}

  <div className={`w-full max-w-4xl relative z-20 flex ${registerVisible ? 'items-center' : 'items-start'} justify-center min-h-[60vh] ${registerVisible ? '' : 'pt-12 md:pt-16 lg:pt-20'} auth-card-wrapper`}>
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