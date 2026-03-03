import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const syncTransactionItemSchema = z.object({
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

const syncTransactionsSchema = z.object({
  transactions: z
    .array(syncTransactionItemSchema)
    .max(200, 'Too many transactions in a single sync request'),
});

function generateReceiptNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `RCP-${timestamp}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const body = await request.json();
    const parsedBody = syncTransactionsSchema.safeParse(body);

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

    const transactions = parsedBody.data.transactions;
    const syncedTransactions = [];

    // Process each pending transaction
    for (const tx of transactions) {
      try {
        const receiptNumber = generateReceiptNumber();
        const { data: createdTx, error: txError } = await supabase
          .from('transactions')
          .insert({
            school_id: userData.school_id,
            student_id: tx.studentId,
            amount_paid: tx.amount,
            fee_type: tx.feeType,
            payment_date: tx.paymentDate,
            notes: tx.notes || '',
            receipt_number: receiptNumber,
            created_by: user.id,
          })
          .select()
          .single();

        if (txError) {
          console.error('Error syncing transaction:', txError);
        } else {
          syncedTransactions.push(createdTx);
        }
      } catch (error) {
        console.error('Error processing transaction:', error);
      }
    }

    return NextResponse.json(
      {
        message: `${syncedTransactions.length} transactions synced successfully`,
        synced: syncedTransactions.length,
        total: transactions.length,
        transactions: syncedTransactions,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    console.error('Sync API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
