import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { validateEmail } from '../lib/validation';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { User, AuthState, LoginData, RegisterData } from '../types';
import { ActivityLogger } from '../lib/activityLogger';

interface AuthContextType extends AuthState {
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  // show a quick profile modal for post-login flow
  showQuickProfileModal: boolean;
  setShowQuickProfileModal: (v: boolean) => void;
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

  // Flag to indicate whether the quick-profile modal should be shown after login
  const [showQuickProfileModal, setShowQuickProfileModal] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // On initial session (page load with active login), show quick modal first
        handleAuthUser(session.user, { triggerQuickModal: true });
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
          // Only trigger quick modal on explicit sign-in events
          handleAuthUser(session.user, { triggerQuickModal: event === 'SIGNED_IN' });
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

  const handleAuthUser = async (supabaseUser: SupabaseUser, options?: { triggerQuickModal?: boolean }) => {
    try {
      console.log('Handling auth user:', supabaseUser.id);
      const meta = (supabaseUser as any).user_metadata || {};
      
      // Get user profile from profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      console.log('Profile fetch result:', { profile, error });

      // If profile doesn't exist, create a basic one
      if (error && error.code === 'PGRST116') {
        console.log('Profile not found, creating new profile from metadata...');
        const seed = {
          id: supabaseUser.id,
          first_name: meta.first_name || '',
          last_name: meta.last_name || '',
          role: 'alumni' as const,
          graduation_year: meta.graduation_year || new Date().getFullYear(),
          course: meta.course || '',
          phone_number: meta.phone_number || '',
          current_job: meta.current_job || null,
          company: meta.company || null,
          location: meta.location || null,
          created_at: new Date().toISOString(),
        };
        const { error: insertError } = await supabase
          .from('profiles')
          .insert(seed);

        if (insertError) {
          console.error('Error creating profile:', insertError);
        } else {
          console.log('Profile created successfully');
        }
      } else if (profile) {
        // Backfill any missing fields from metadata on existing profile
        const patch: Record<string, any> = {};
        if (!profile.first_name && meta.first_name) patch.first_name = meta.first_name;
        if (!profile.last_name && meta.last_name) patch.last_name = meta.last_name;
        if (!profile.course && meta.course) patch.course = meta.course;
        if (!profile.graduation_year && meta.graduation_year) patch.graduation_year = meta.graduation_year;
        if (!profile.phone_number && meta.phone_number) patch.phone_number = meta.phone_number;
        if (!profile.current_job && meta.current_job) patch.current_job = meta.current_job;
        if (!profile.company && meta.company) patch.company = meta.company;
        if (!profile.location && meta.location) patch.location = meta.location;

        if (Object.keys(patch).length > 0) {
          console.log('Backfilling profile fields from metadata:', patch);
          await supabase.from('profiles').update(patch).eq('id', supabaseUser.id);
        }
      }

      // Re-fetch profile to get the latest data after potential insert/backfill
      const { data: finalProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      const user: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        firstName: finalProfile?.first_name || '',
        lastName: finalProfile?.last_name || '',
        role: 'alumni',
        graduationYear: finalProfile?.graduation_year || new Date().getFullYear(),
        course: finalProfile?.course || '',
        currentJob: finalProfile?.current_job || '',
        company: finalProfile?.company || '',
        location: finalProfile?.location || '',
        phoneNumber: finalProfile?.phone_number || '',
        isVerified: supabaseUser.email_confirmed_at !== null,
        createdAt: new Date(supabaseUser.created_at),
      };

      console.log('Setting user state:', user);

      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });

      // Always show the quick profile modal on login/initial session when requested
      if (options?.triggerQuickModal) {
        setShowQuickProfileModal(true);
      }
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
        // Do not trigger the quick modal on background refreshes
        await handleAuthUser(supabaseUser, { triggerQuickModal: false });
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
      // Defensive email validation (UI already validates but double-check to avoid bounces)
      const emailCheck = validateEmail(data.email);
      if (!emailCheck.valid) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        throw new Error(emailCheck.reason || 'Invalid email');
      }

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
        // Create or update user profile (id is PK)
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            first_name: data.firstName,
            last_name: data.lastName,
            role: 'alumni',
            graduation_year: data.graduationYear,
            course: data.course,
            phone_number: data.phoneNumber || null,
            created_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (profileError) {
          console.error('Error upserting profile:', profileError);
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
    showQuickProfileModal,
    setShowQuickProfileModal,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};