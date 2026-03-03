import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeRequest } from '@/lib/server/authz';

const syncItemSchema = z.object({
  feeStructureId: z.string().uuid().optional().nullable(),
  description: z
    .string({ required_error: 'description is required' })
    .trim()
    .min(1, 'description is required')
    .max(200, 'description is too long'),
  amount: z.coerce
    .number({ invalid_type_error: 'amount must be a number' })
    .positive('amount must be greater than zero')
    .max(1_000_000_000, 'amount is too large'),
});

const syncModernTransactionSchema = z.object({
  localId: z.string().min(1).max(120).optional(),
  studentId: z.string().uuid('studentId must be a valid UUID'),
  paymentDate: z
    .string({ required_error: 'paymentDate is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'paymentDate must be YYYY-MM-DD'),
  notes: z.string().trim().max(1000, 'notes is too long').optional(),
  items: z
    .array(syncItemSchema)
    .min(1, 'At least one fee item is required')
    .max(50, 'Too many fee items'),
});

const syncLegacyTransactionSchema = z.object({
  id: z.string().min(1).optional(),
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

const normalizedSyncTransactionSchema = z
  .union([syncModernTransactionSchema, syncLegacyTransactionSchema])
  .transform((data) => {
    if ('items' in data) {
      return data;
    }

    return {
      localId: data.id,
      studentId: data.studentId,
      paymentDate: data.paymentDate,
      notes: data.notes,
      items: [
        {
          feeStructureId: null,
          description: data.feeType,
          amount: data.amount,
        },
      ],
    };
  });

const syncTransactionsSchema = z.object({
  transactions: z
    .array(normalizedSyncTransactionSchema)
    .max(200, 'Too many transactions in a single sync request'),
});

function generateReceiptNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `RCP-${timestamp}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeRequest([
      'admin',
      'accountant',
      'fee_operator',
    ]);
    if ('response' in authorization) {
      return authorization.response;
    }

    const { supabase, user, profile } = authorization;
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

    const transactions = parsedBody.data.transactions;
    const syncedTransactions: Array<{
      localId: string | null;
      id: string;
      receiptNumber: string;
    }> = [];
    const failedTransactions: Array<{
      localId: string | null;
      error: string;
    }> = [];

    for (const tx of transactions) {
      try {
        const totalAmount = tx.items.reduce((sum, item) => sum + item.amount, 0);
        const feeTypeSummary =
          tx.items.length === 1
            ? tx.items[0].description
            : `${tx.items.length} fee items`;

        const receiptNumber = generateReceiptNumber();
        const { data: createdTx, error: txError } = await supabase
          .from('transactions')
          .insert({
            school_id: profile.school_id,
            student_id: tx.studentId,
            amount_paid: totalAmount,
            fee_type: feeTypeSummary,
            payment_date: tx.paymentDate,
            notes: tx.notes || '',
            receipt_number: receiptNumber,
            created_by: user.id,
          })
          .select('id, receipt_number')
          .single();

        if (txError || !createdTx) {
          failedTransactions.push({
            localId: tx.localId || null,
            error: txError?.message || 'Failed to create transaction',
          });
          continue;
        }

        const itemsPayload = tx.items.map((item) => ({
          transaction_id: createdTx.id,
          fee_structure_id: item.feeStructureId || null,
          description: item.description,
          amount: item.amount,
        }));

        const { error: itemsError } = await supabase
          .from('transaction_items')
          .insert(itemsPayload);

        if (itemsError) {
          failedTransactions.push({
            localId: tx.localId || null,
            error: `Transaction created but items failed: ${itemsError.message}`,
          });
          continue;
        }

        syncedTransactions.push({
          localId: tx.localId || null,
          id: createdTx.id,
          receiptNumber: createdTx.receipt_number,
        });
      } catch (error) {
        failedTransactions.push({
          localId: tx.localId || null,
          error:
            error instanceof Error ? error.message : 'Unexpected sync failure',
        });
      }
    }

    return NextResponse.json(
      {
        message: `${syncedTransactions.length} transactions synced successfully`,
        synced: syncedTransactions.length,
        failed: failedTransactions.length,
        total: transactions.length,
        syncedLocalIds: syncedTransactions
          .map((transaction) => transaction.localId)
          .filter((localId): localId is string => Boolean(localId)),
        transactions: syncedTransactions,
        failures: failedTransactions,
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
