import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { User, AuthState, LoginData, RegisterData } from '../types';
import { ActivityLogger } from '../lib/activityLogger';

interface AuthContextType extends AuthState {
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleAuthUser(session.user);
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          handleAuthUser(session.user);
        } else {
          setAuthState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthUser = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('Handling auth user:', supabaseUser.id);
      
      // Get user profile from profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      console.log('Profile fetch result:', { profile, error });

      // If profile doesn't exist, create a basic one
      if (error && error.code === 'PGRST116') {
        console.log('Profile not found, creating new profile...');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: supabaseUser.id,
            first_name: '',
            last_name: '',
            role: 'alumni',
            graduation_year: new Date().getFullYear(),
            course: '',
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
        } else {
          console.log('Profile created successfully');
        }
      }

      const user: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        role: 'alumni',
        graduationYear: profile?.graduation_year || new Date().getFullYear(),
        course: profile?.course || '',
        currentJob: profile?.current_job || '',
        company: profile?.company || '',
        location: profile?.location || '',
        phoneNumber: profile?.phone_number || '',
        isVerified: supabaseUser.email_confirmed_at !== null,
        createdAt: new Date(supabaseUser.created_at),
      };

      console.log('Setting user state:', user);

      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Error in handleAuthUser:', error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (supabaseUser) {
        await handleAuthUser(supabaseUser);
      }
    } catch (error) {
      // Silently handle refresh errors
    }
  };

  const login = async (data: LoginData): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
      }

      // Log successful login
      setTimeout(() => {
        ActivityLogger.logLogin();
      }, 1000);

      // User state will be updated by the auth state change listener
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const register = async (data: RegisterData): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            graduation_year: data.graduationYear,
            course: data.course,
            phone_number: data.phoneNumber,
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            first_name: data.firstName,
            last_name: data.lastName,
            role: 'alumni',
            graduation_year: data.graduationYear,
            course: data.course,
            phone_number: data.phoneNumber,
            created_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          // Don't throw here as the user is already created
        }
      }

      // Log successful registration
      if (authData.user) {
        setTimeout(() => {
          ActivityLogger.logRegistration();
        }, 1000);
      }

      // Always set loading to false after registration
      setAuthState(prev => ({ ...prev, isLoading: false }));

      // If no session, user needs to confirm email
      if (!authData.session) {
        // Registration successful, but email confirmation required
        return;
      }

      // User state will be updated by the auth state change listener
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = () => {
    // Log logout before signing out
    ActivityLogger.logLogout();
    
    supabase.auth.signOut().then(() => {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }).catch((error) => {
      console.error('Error signing out:', error);
    });
  };

  const value: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};