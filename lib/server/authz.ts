import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type AppUserRole = 'admin' | 'accountant' | 'fee_operator';

interface UserProfile {
  id: string;
  school_id: string;
  role: AppUserRole;
  is_active: boolean;
  name: string;
}

type AuthorizationSuccess = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: {
    id: string;
    email?: string;
  };
  profile: UserProfile;
};

type AuthorizationResult =
  | AuthorizationSuccess
  | {
      response: NextResponse;
    };

export async function authorizeRequest(
  allowedRoles: AppUserRole[] = ['admin', 'accountant', 'fee_operator']
): Promise<AuthorizationResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, school_id, role, is_active, name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      response: NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      ),
    };
  }

  if (!profile.is_active) {
    return {
      response: NextResponse.json(
        { error: 'User account is inactive' },
        { status: 403 }
      ),
    };
  }

  if (!allowedRoles.includes(profile.role as AppUserRole)) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile as UserProfile,
  };
}
