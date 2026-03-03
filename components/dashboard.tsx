'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { FeeCollectionForm } from './fee-collection-form';

interface DashboardProps {
  user?: any;
  demoMode?: boolean;
}

export function Dashboard({ user, demoMode = false }: DashboardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-blue-600">Tilak School</h1>
            <p className="text-xs text-gray-600">Fee Management System</p>
          </div>
          <div className="flex items-center gap-4">
            {user?.email && (
              <span className="text-sm text-gray-700">{user.email}</span>
            )}
            {demoMode ? (
              <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                Local Demo Mode
              </span>
            ) : (
              <Button
                onClick={handleLogout}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {loading ? 'Signing out...' : 'Sign Out'}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="print:m-0 print:p-0">
        <FeeCollectionForm />
      </main>
    </div>
  );
}
