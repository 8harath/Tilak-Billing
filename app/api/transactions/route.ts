import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeRequest } from '@/lib/server/authz';
import {
  createFeeTransactionAtomic,
  TransactionRpcError,
} from '@/lib/server/transaction-rpc';

const transactionItemSchema = z.object({
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

const modernCreateTransactionSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
  paymentDate: z
    .string({ required_error: 'paymentDate is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'paymentDate must be YYYY-MM-DD'),
  notes: z.string().trim().max(1000, 'notes is too long').optional(),
  items: z
    .array(transactionItemSchema)
    .min(1, 'At least one fee item is required')
    .max(50, 'Too many fee items'),
});

const legacyCreateTransactionSchema = z.object({
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

const createTransactionSchema = z
  .union([modernCreateTransactionSchema, legacyCreateTransactionSchema])
  .transform((data) => {
    if ('items' in data) {
      return data;
    }

    return {
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

const transactionListSelect = `
  id,
  receipt_number,
  student_id,
  amount_paid,
  fee_type,
  payment_date,
  created_at,
  notes,
  students:student_id(
    id,
    name,
    roll_number,
    class,
    section
  )
`;

const transactionDetailsSelect = `
  id,
  receipt_number,
  student_id,
  amount_paid,
  fee_type,
  payment_date,
  created_at,
  notes,
  students:student_id(
    id,
    name,
    roll_number,
    class,
    section,
    parent_email,
    parent_phone
  ),
  transaction_items(
    id,
    fee_structure_id,
    description,
    amount
  )
`;

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest();
    if ('response' in authorization) {
      return authorization.response;
    }

    const { supabase, profile } = authorization;
    const { searchParams } = new URL(request.url);
    const receiptNumber = (searchParams.get('receiptNumber') || '').trim();
    const limitParam = Number(searchParams.get('limit') || '100');
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 100;

    if (receiptNumber) {
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select(transactionDetailsSelect)
        .eq('school_id', profile.school_id)
        .eq('receipt_number', receiptNumber)
        .single();

      if (txError) {
        if (txError.code === 'PGRST116') {
          return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
        }
        return NextResponse.json({ error: txError.message }, { status: 500 });
      }

      const studentRecord = Array.isArray(transaction.students)
        ? transaction.students[0] || null
        : transaction.students;

      return NextResponse.json({
        ...transaction,
        students: studentRecord,
        transaction_items: Array.isArray(transaction.transaction_items)
          ? transaction.transaction_items
          : [],
        student_name: studentRecord?.name || 'Unknown',
      });
    }

    // Get transaction list for this school
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(transactionListSelect)
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // Map student data
    const mappedTransactions = (transactions || []).map((tx) => ({
      ...tx,
      students: Array.isArray(tx.students) ? tx.students[0] || null : tx.students,
      student_name: (
        Array.isArray(tx.students) ? tx.students[0] || null : tx.students
      )?.name || 'Unknown',
    }));

    return NextResponse.json(mappedTransactions);
  } catch (error) {
    console.error('Transactions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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

    const { supabase } = authorization;
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

    const created = await createFeeTransactionAtomic({
      supabase,
      studentId: parsedBody.data.studentId,
      paymentDate: parsedBody.data.paymentDate,
      notes: parsedBody.data.notes || '',
      items: parsedBody.data.items.map((item) => ({
        feeStructureId: item.feeStructureId || null,
        description: item.description,
        amount: item.amount,
      })),
    });

    const { data: createdTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select(transactionDetailsSelect)
      .eq('id', created.id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { id: created.id, receipt_number: created.receiptNumber },
        { status: 201 }
      );
    }

    return NextResponse.json(createdTransaction, { status: 201 });
  } catch (error) {
    if (error instanceof TransactionRpcError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    console.error('Transaction creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
