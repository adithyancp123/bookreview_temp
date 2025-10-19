import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser, User } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  profile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start loading

  // Updated useEffect Hook from previous step
  useEffect(() => {
    let isMounted = true; // Flag to prevent updates on unmounted component

    // Function to check the current session and update state
    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Error getting session:", sessionError);
      }

      if (isMounted) {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false); // Mark loading as false only after initial check
      }
    };

    // Run the initial check
    checkSession();

    // Set up the listener for future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth State Changed!', event, session); // Keep debug log
        // No need to check isMounted here as subscription handles cleanup
        setUser(session?.user ?? null);
        if (session?.user) {
          console.log('Fetching profile for user:', session.user.id); // Keep debug log
          await fetchProfile(session.user.id);
        } else {
          console.log('No user session, clearing profile.'); // Keep debug log
          setProfile(null);
        }
        // Ensure loading is false after any auth change (including sign out)
        setLoading(false);
      }
    );

    // Cleanup function
    return () => {
      isMounted = false; // Mark as unmounted
      subscription?.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Even if profile fetch fails, don't clear the user, just the profile
      setProfile(null);
    }
  };

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  // --- MODIFIED signUp function ---
  const signUp = async (email: string, password: string, fullName: string) => {
    // Profile creation is handled by the database trigger
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // This metadata will be used by the database trigger
        data: {
          full_name: fullName,
        },
      },
    });

    // --- NEW: Manually update state on successful sign up ---
    if (!error && data.user) {
      console.log('Sign up successful, manually setting user and fetching profile.'); // Debug log
      setUser(data.user); // Manually set the user state
      await fetchProfile(data.user.id); // Manually trigger profile fetch
      setLoading(false); // Ensure loading is false
    } else if (error) {
      console.error('Sign up error:', error);
    }
    // --- END NEW ---

    return { error };
  };
  // --- END MODIFIED signUp function ---

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (!error) {
      // Re-fetch profile after update to ensure UI consistency
      await fetchProfile(user.id);
    }

    return { error };
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}