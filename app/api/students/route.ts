import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim();
    const classFilter = (searchParams.get('class') || '').trim();
    const limitParam = Number(searchParams.get('limit') || '20');
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20;

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
    let studentsQuery = supabase
      .from('students')
      .select('id, name, roll_number, class, section, parent_email, parent_phone, status')
      .eq('school_id', userData.school_id)
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(limit);

    if (classFilter && classFilter.toLowerCase() !== 'all') {
      studentsQuery = studentsQuery.eq('class', classFilter);
    }

    if (query) {
      const escapedQuery = query.replace(/,/g, ' ');
      studentsQuery = studentsQuery.or(
        `name.ilike.%${escapedQuery}%,roll_number.ilike.%${escapedQuery}%`
      );
    }

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 });
    }

    return NextResponse.json(students);
  } catch (error) {
    console.error('Students API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
