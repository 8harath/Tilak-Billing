import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/server/authz';

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest();
    if ('response' in authorization) {
      return authorization.response;
    }

    const { supabase, profile } = authorization;
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim();
    const classFilter = (searchParams.get('class') || '').trim();
    const limitParam = Number(searchParams.get('limit') || '20');
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 100)
      : 20;

    // Get students for this school
    let studentsQuery = supabase
      .from('students')
      .select('id, name, roll_number, class, section, parent_email, parent_phone, status')
      .eq('school_id', profile.school_id)
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
