import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's school
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get students for this school
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', userData.school_id)
      .eq('status', 'active');

    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    return NextResponse.json(students);
  } catch (error) {
    console.error('Students API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
