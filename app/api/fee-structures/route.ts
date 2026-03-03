import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const classFilter = searchParams.get('class');

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

    // Get fee structures for this school
    let query = supabase
      .from('fee_structures')
      .select('*')
      .eq('school_id', userData.school_id);

    if (classFilter) {
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
