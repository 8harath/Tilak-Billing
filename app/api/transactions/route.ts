import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createTransactionSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
  amount: z.coerce
    .number({ invalid_type_error: 'amount must be a number' })
    .positive('amount must be greater than zero')
    .max(1_000_000_000, 'amount is too large'),
  feeType: z
    .string({ required_error: 'feeType is required' })
    .trim()
    .min(1, 'feeType is required')
    .max(120, 'feeType is too long'),
  paymentDate: z
    .string({ required_error: 'paymentDate is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'paymentDate must be YYYY-MM-DD'),
  notes: z.string().trim().max(1000, 'notes is too long').optional(),
});

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
    const parsedBody = createTransactionSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsedBody.error.issues.map((issue) => issue.message),
        },
        { status: 400 }
      );
    }

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
        student_id: parsedBody.data.studentId,
        amount_paid: parsedBody.data.amount,
        fee_type: parsedBody.data.feeType,
        payment_date: parsedBody.data.paymentDate,
        notes: parsedBody.data.notes || '',
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
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    console.error('Transaction creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
