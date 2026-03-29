// src/lib/auth.js
import { supabase } from './supabase';
import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  loading: false,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchProfile(session.user);
    } else {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) await fetchProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null, loading: false });
      }
    });
  },
}));

const fetchProfile = async (user) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, banned, full_name, subscription_plan')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Profile fetch error:', error);
    return;
  }

  if (profile?.banned) {
    await supabase.auth.signOut();
    alert('Your account has been banned by admin.');
    return;
  }

  useAuthStore.setState({
    user,
    profile,
    loading: false,
  });
};