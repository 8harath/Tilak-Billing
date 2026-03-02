// Script to create a demo user in Supabase Auth
// Run: node scripts/03-create-demo-user.js
// Note: This requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createDemoUser() {
  try {
    console.log('Creating demo user...');

    // Create auth user
    const { data: user, error: authError } = await supabase.auth.admin.createUser({
      email: 'staff@school.com',
      password: 'Password123!',
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already exists')) {
        console.log('Demo user already exists, getting user info...');
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find((u) => u.email === 'staff@school.com');
        if (existingUser) {
          await createUserProfile(existingUser.id);
          console.log('Demo user profile created successfully!');
        }
      } else {
        throw authError;
      }
    } else if (user?.user?.id) {
      await createUserProfile(user.user.id);
      console.log('Demo user created successfully!');
      console.log('Email: staff@school.com');
      console.log('Password: Password123!');
    }
  } catch (error) {
    console.error('Error creating demo user:', error);
    process.exit(1);
  }
}

async function createUserProfile(userId) {
  try {
    // Get the school ID (should be Tilak School)
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('name', 'Tilak School')
      .single();

    if (!school) {
      console.error('Tilak School not found');
      return;
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          school_id: school.id,
          role: 'fee_operator',
          name: 'Demo Staff',
          is_active: true,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error('Error creating user profile:', profileError);
    }
  } catch (error) {
    console.error('Error creating user profile:', error);
  }
}

createDemoUser();
