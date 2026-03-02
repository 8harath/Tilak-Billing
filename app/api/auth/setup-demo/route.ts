import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create auth user
    const { data: user, error: authError } = await supabase.auth.admin.createUser({
      email: 'staff@school.com',
      password: 'Password123!',
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already exists')) {
        return Response.json(
          { message: 'Demo user already exists' },
          { status: 200 }
        );
      }
      throw authError;
    }

    // Get school ID
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('name', 'Tilak School')
      .single();

    if (school?.id) {
      // Create user profile
      await supabase.from('users').upsert(
        {
          id: user.user.id,
          school_id: school.id,
          role: 'fee_operator',
          name: 'Demo Staff',
          is_active: true,
        },
        { onConflict: 'id' }
      );
    }

    return Response.json(
      { message: 'Demo user created successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Setup error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to setup demo user' },
      { status: 500 }
    );
  }
}
