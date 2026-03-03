'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('staff@school.com');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupDone, setSetupDone] = useState(false);
  const router = useRouter();

  const handleSetupDemo = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/setup-demo', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to setup demo user');
      }

      setSetupDone(true);
      setError('');
      // Auto-login after setup
      setTimeout(() => {
        handleLogin(new Event('submit') as any);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup demo user');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent | Event) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground text-center">
            School Fee Manager
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Sign in to manage fee payments
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {setupDone && (
            <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">Demo user setup complete! Signing you in...</p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="staff@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email || !password}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="space-y-3">
          <Button
            type="button"
            onClick={handleSetupDemo}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? 'Setting up...' : 'Setup & Test Demo'}
          </Button>
        </div>

        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center font-medium">
            Demo Credentials
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Email: staff@school.com
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Password: Password123!
          </p>
        </div>
      </Card>
    </div>
  );
}

