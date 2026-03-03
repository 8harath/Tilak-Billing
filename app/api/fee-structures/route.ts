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
    const classFilter = (searchParams.get('class') || '').trim();

    // Get fee structures for this school
    let query = supabase
      .from('fee_structures')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('name', { ascending: true });

    if (classFilter && classFilter.toLowerCase() !== 'all') {
      query = query.eq('class', classFilter);
    }

    const { data: feeStructures, error: feeError } = await query;

    if (feeError) {
      return NextResponse.json({ error: feeError.message }, { status: 500 });
    }

    return NextResponse.json(feeStructures);
  } catch (error) {
    console.error('Fee structures API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
