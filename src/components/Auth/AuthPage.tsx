import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import PreRegisterGreeting from './PreRegisterGreeting';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showGreeting, setShowGreeting] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
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
              try {
                const seen = typeof window !== 'undefined' && sessionStorage.getItem('reg_greeting_seen') === '1';
                if (seen) {
                  setIsLogin(false);
                } else {
                  setShowGreeting(true);
                }
              } catch {
                setShowGreeting(true);
              }
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