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
        setRole('user');
        return;
      }
      
      if (!data) {
        console.log('[AuthContext] No profile found, creating one...');
        // If profile doesn't exist, create it as a regular user
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
        
        if (!createError && newProfile) {
          console.log('[AuthContext] Profile created successfully');
          setProfile(newProfile);
          setRole(newProfile.role);
        } else {
          console.error('[AuthContext] Error creating profile:', createError);
          setRole('user');
        }
      } else {
        console.log('[AuthContext] Profile loaded:', data.role);
        setProfile(data);
        setRole(data.role);
      }
    } catch (err) {
      console.error('[AuthContext] Unexpected error in fetchProfile:', err);
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
        fetchProfile(currentUser.id, currentUser).finally(() => {
          setIsLoading(false);
          console.log('[AuthContext] Initial load complete (user logged in)');
        });
      } else {
        setProfile(null);
        setRole(null);
        setIsLoading(false);
        console.log('[AuthContext] Initial load complete (no user)');
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthContext] Auth state change event:', event);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || (event === 'USER_UPDATED' && !profile)) {
          setIsLoading(true); // Re-show loading if we need to fetch profile
          fetchProfile(currentUser.id, currentUser).finally(() => setIsLoading(false));
        }
      } else {
        setProfile(null);
        setRole(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
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
