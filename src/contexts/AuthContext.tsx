import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  role: 'admin' | 'user';
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  state?: string | null;
  city?: string | null;
  bio?: string | null;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: 'admin' | 'user' | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (isOpen: boolean) => void;
  isRegisterUserModalOpen: boolean;
  setIsRegisterUserModalOpen: (isOpen: boolean) => void;
  isResetPasswordModalOpen: boolean;
  setIsResetPasswordModalOpen: (isOpen: boolean) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegisterUserModalOpen, setIsRegisterUserModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);

  const fetchProfile = async (userId: string, currentUser?: User | null) => {
    console.log('[AuthContext] Fetching profile for:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); 
      
      if (error) {
        console.error('[AuthContext] Error fetching profile:', error);
      }
      
      if (!data) {
        console.log('[AuthContext] No profile found, creating one...');
        const targetUser = currentUser || user;
        const newProfileData = { 
          id: userId, 
          role: 'user' as const, 
          email: targetUser?.email || '',
          full_name: targetUser?.user_metadata?.full_name || '',
          avatar_url: targetUser?.user_metadata?.avatar_url || '',
          state: targetUser?.user_metadata?.state || '',
          city: targetUser?.user_metadata?.city || '',
          phone: targetUser?.user_metadata?.phone || ''
        };
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([newProfileData])
          .select('*')
          .single();
        
        if (createError || !newProfile) {
          console.warn('[AuthContext] Profile creation error or delay, retrying fetch...', createError);
          const { data: retryData } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
          if (retryData) {
            setProfile(retryData);
            setRole(retryData.role);
            return;
          }
          // Fallback to in-memory profile to ensure UI and role continuity
          const fallbackProfile: Profile = {
            id: userId,
            role: 'user',
            email: targetUser?.email || '',
            full_name: targetUser?.user_metadata?.full_name || '',
            avatar_url: targetUser?.user_metadata?.avatar_url || '',
            phone: targetUser?.user_metadata?.phone || ''
          };
          setProfile(fallbackProfile);
          setRole('user');
        } else {
          console.log('[AuthContext] Profile created successfully');
          setProfile(newProfile);
          setRole(newProfile.role);
        }
      } else {
        console.log('[AuthContext] Profile loaded:', data.role);
        setProfile(data);
        setRole(data.role);
      }
    } catch (err) {
      console.error('[AuthContext] Unexpected error in fetchProfile:', err);
      const targetUser = currentUser || user;
      setProfile({ id: userId, role: 'user', email: targetUser?.email || '' });
      setRole('user');
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  useEffect(() => {
    console.log('[AuthContext] Initializing auth state...');
    const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');
    
    if (isPlaceholder) {
      console.warn('[AuthContext] Supabase placeholder detected');
      setIsLoading(false);
      return;
    }

    // Clean URL if OAuth or recovery params are present after session is processed
    const cleanUrlIfNeeded = () => {
      if (typeof window !== 'undefined' && (
        window.location.search.includes('code=') || 
        window.location.hash.includes('access_token=') ||
        window.location.hash.includes('error=') ||
        window.location.search.includes('error=')
      )) {
        setTimeout(() => {
          try {
            const cleanPath = window.location.pathname === '/auth/callback' ? '/' : window.location.pathname;
            window.history.replaceState({}, document.title, cleanPath);
          } catch (e) {}
        }, 500);
      }
    };

    // Check if URL indicates password recovery
    if (typeof window !== 'undefined' && (window.location.href.includes('type=recovery') || window.location.hash.includes('type=recovery'))) {
      setIsResetPasswordModalOpen(true);
      setIsAuthModalOpen(false);
      setIsRegisterUserModalOpen(false);
    }

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[AuthContext] Get session error:', error);
        setIsLoading(false);
        return;
      }
      
      const currentUser = session?.user ?? null;
      console.log('[AuthContext] Initial session:', currentUser ? 'Found' : 'Not found');
      setUser(currentUser);
      if (currentUser) {
        setIsAuthModalOpen(false);
        setIsRegisterUserModalOpen(false);
        fetchProfile(currentUser.id, currentUser).finally(() => {
          setIsLoading(false);
          cleanUrlIfNeeded();
          console.log('[AuthContext] Initial load complete (user logged in)');
        });
      } else {
        setProfile(null);
        setRole(null);
        setIsLoading(false);
        cleanUrlIfNeeded();
        console.log('[AuthContext] Initial load complete (no user)');
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state change event:', event);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          setIsAuthModalOpen(false);
          setIsRegisterUserModalOpen(false);
          cleanUrlIfNeeded();
        }
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || (event === 'USER_UPDATED' && !profile)) {
          fetchProfile(currentUser.id, currentUser).finally(() => setIsLoading(false));
        }
        if (event === 'PASSWORD_RECOVERY') {
          console.log('[AuthContext] PASSWORD_RECOVERY event captured!');
          setIsResetPasswordModalOpen(true);
          setIsAuthModalOpen(false);
          setIsRegisterUserModalOpen(false);
        }
      } else {
        setProfile(null);
        setRole(null);
        setIsLoading(false);
      }
    });

    // Handle visibility change to auto-refresh session after sleep / tab switch / PWA resume
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isPlaceholder) {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error || !session) {
            if (user) {
              setUser(null);
              setProfile(null);
              setRole(null);
            }
          } else if (session.user && session.user.id !== user?.id) {
            setUser(session.user);
            fetchProfile(session.user.id, session.user);
          }
        });
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    // Google OAuth popup message listener (backwards compatibility)
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SUPABASE_OAUTH_SUCCESS' || event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log('[AuthContext] Popup notify success. Checking session...');
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user);
            setIsAuthModalOpen(false);
            setIsRegisterUserModalOpen(false);
            fetchProfile(session.user.id, session.user);
          }
        });
      }
    };
    window.addEventListener('message', handleOAuthMessage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthContext] Error during signOut:', e);
    }
    setUser(null);
    setProfile(null);
    setRole(null);
    setIsAuthModalOpen(false);
    setIsRegisterUserModalOpen(false);
    setIsResetPasswordModalOpen(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      role, 
      isLoading, 
      isAuthModalOpen, 
      setIsAuthModalOpen,
      isRegisterUserModalOpen,
      setIsRegisterUserModalOpen,
      isResetPasswordModalOpen,
      setIsResetPasswordModalOpen,
      signOut, 
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
