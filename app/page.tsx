'use client';

import { useEffect, useState } from 'react';
import {
  createClient,
  isLocalDemoModeEnabled,
  isSupabaseConfigured,
} from '@/lib/supabase/client';
import { LoginForm } from '@/components/login-form';
import { Dashboard } from '@/components/dashboard';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [missingConfig, setMissingConfig] = useState(false);

  useEffect(() => {
    setMounted(true);
    const supabaseConfigured = isSupabaseConfigured();
    const localDemoEnabled = isLocalDemoModeEnabled();

    if (!supabaseConfigured && localDemoEnabled) {
      setDemoMode(true);
      setUser({ email: 'local-demo@tilak-school.local' });
      setLoading(false);
      return;
    }

    if (!supabaseConfigured) {
      setMissingConfig(true);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error('Auth check error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (missingConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-6">
        <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-8 border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Supabase Is Not Configured
          </h1>
          <p className="text-gray-700 mb-4">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
            <code>.env.local</code>.
          </p>
          <p className="text-sm text-gray-600">
            For UI-only testing in development, you can enable local demo mode
            with <code>NEXT_PUBLIC_ENABLE_LOCAL_DEMO_MODE=true</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <Dashboard user={user} demoMode={demoMode} />;
}
