import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, Loader2, } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginData } from '../../types';
import ForgotPasswordForm from './ForgotPasswordForm';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginData>>({});
  const [showRegisteredAlert, setShowRegisteredAlert] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginData> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await login(formData);
    } catch (error) {
      let errorMessage = 'Invalid email or password';
      
      if (error instanceof Error) {
        if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and confirm your account before signing in.';
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setErrors({ email: errorMessage });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof LoginData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  if (showForgotPassword) {
    return (
      <ForgotPasswordForm 
        onBackToLogin={() => setShowForgotPassword(false)}
      />
    );
  }

  useEffect(() => {
    try {
      if (localStorage.getItem('justRegistered') === '1') {
        setShowRegisteredAlert(true);
        localStorage.removeItem('justRegistered');
        const timer = setTimeout(() => setShowRegisteredAlert(false), 6000);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // ignore storage errors
    }
  }, []);
  return (
  <div className="w-full max-w-sm sm:max-w-md mx-auto bg-white rounded-2xl shadow-xl px-5 py-6 sm:px-8 sm:py-8 space-y-6 login-card">
  <div className="text-center mb-6 sm:mb-8 space-y-3">
    <div className="mx-auto rounded-full overflow-hidden flex items-center justify-center bg-white w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24">
      <img
        src="/logo.jpeg"
        alt="School Logo"
        className="w-full h-full object-contain max-w-full"
      />
    </div>
    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Welcome Back</h2>
    <p className="text-gray-600 text-sm sm:text-base">Sign in to access your alumni portal</p>
  </div>
      {showRegisteredAlert && (
        <div className="max-w-md mx-auto mb-4 bg-blue-50 border border-blue-300 text-blue-900 px-4 py-3 rounded-lg relative" role="status" aria-live="polite">
          <div className="flex items-start">
            <div className="flex-1">Registration successful. Check your email to verify your account, then sign in.</div>
            <button
              aria-label="Close registration alert"
              onClick={() => setShowRegisteredAlert(false)}
              className="text-blue-700 font-bold ml-3"
            >
              ×
            </button>
          </div>
        </div>
      )}
  <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm sm:text-base ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your email"
            />
          </div>
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm sm:text-base ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium text-sm sm:text-base hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium"
          >
            Forgot your password?
          </button>
        </div>
      </form>

      <div className="mt-5 sm:mt-6 text-center">
        <p className="text-gray-600">
          Don't have an account?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Sign up here
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;