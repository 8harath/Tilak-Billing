import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface TransactionItemInput {
  feeStructureId: string | null;
  description: string;
  amount: number;
}

interface CreateFeeTransactionParams {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  studentId: string;
  paymentDate: string;
  notes?: string;
  items: TransactionItemInput[];
}

interface CreateFeeTransactionResult {
  id: string;
  receiptNumber: string;
}

export class TransactionRpcError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'TransactionRpcError';
    this.statusCode = statusCode;
  }
}

function parseRpcErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === 'PGRST202') {
    return 'Database function create_fee_transaction is missing. Run scripts/04-atomic-sequential-receipts.sql.';
  }

  return error.message || 'Failed to create transaction';
}

export async function createFeeTransactionAtomic({
  supabase,
  studentId,
  paymentDate,
  notes,
  items,
}: CreateFeeTransactionParams): Promise<CreateFeeTransactionResult> {
  const { data, error } = await supabase.rpc('create_fee_transaction', {
    p_student_id: studentId,
    p_payment_date: paymentDate,
    p_notes: notes || null,
    p_items: items.map((item) => ({
      feeStructureId: item.feeStructureId,
      description: item.description,
      amount: item.amount,
    })),
  });

  if (error) {
    throw new TransactionRpcError(parseRpcErrorMessage(error), 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id || !row?.receipt_number) {
    throw new TransactionRpcError('Transaction RPC returned invalid data', 500);
  }

  return {
    id: row.id,
    receiptNumber: row.receipt_number,
  };
}
