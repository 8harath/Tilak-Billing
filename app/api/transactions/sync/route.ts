import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function generateReceiptNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `RCP-${timestamp}-${random}`;
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

    const transactions = body.transactions || [];
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
    console.error('Sync API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
