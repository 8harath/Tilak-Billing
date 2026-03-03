import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function generateReceiptNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `RCP-${timestamp}-${random}`;
}

export async function GET(request: NextRequest) {
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

    // Get transactions for this school
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(`
        id,
        receipt_number,
        student_id,
        amount_paid,
        fee_type,
        payment_date,
        created_at,
        notes,
        students:student_id(name)
      `)
      .eq('school_id', userData.school_id)
      .order('created_at', { ascending: false });

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // Map student data
    const mappedTransactions = transactions?.map((tx: any) => ({
      ...tx,
      student_name: tx.students?.name || 'Unknown',
    })) || [];

    return NextResponse.json(mappedTransactions);
  } catch (error) {
    console.error('Transactions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const body = await request.json();

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

    // Create transaction
    const receiptNumber = generateReceiptNumber();
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        school_id: userData.school_id,
        student_id: body.studentId,
        amount_paid: body.amount,
        fee_type: body.feeType,
        payment_date: body.paymentDate,
        notes: body.notes || '',
        receipt_number: receiptNumber,
        created_by: user.id,
      })
      .select()
      .single();

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Transaction creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
