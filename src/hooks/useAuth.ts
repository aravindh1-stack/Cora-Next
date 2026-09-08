'use client';

import { useEffect, useState } from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type AuthResult = { error: AuthError | Error | null };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!mounted) return;
        setSession(data.session);
        setError(sessionError);
        setLoading(false);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (mounted) setSession(nextSession);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (clientError) {
      queueMicrotask(() => {
        setError(clientError instanceof Error ? clientError : new Error('Unable to initialize authentication.'));
        setLoading(false);
      });
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  async function login(email: string, password: string): Promise<AuthResult> {
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      return { error: authError };
    } catch (clientError) {
      return { error: clientError instanceof Error ? clientError : new Error('Unable to sign in.') };
    }
  }

  async function register(email: string, password: string, fullName: string): Promise<AuthResult> {
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      return { error: authError };
    } catch (clientError) {
      return { error: clientError instanceof Error ? clientError : new Error('Unable to create account.') };
    }
  }

  async function logout(): Promise<AuthResult> {
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.signOut();
      return { error: authError };
    } catch (clientError) {
      return { error: clientError instanceof Error ? clientError : new Error('Unable to sign out.') };
    }
  }

  return { session, user: session?.user as User | undefined, loading, error, login, register, logout };
}
