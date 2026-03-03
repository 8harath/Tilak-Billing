import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeRequest } from '@/lib/server/authz';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const reportQuerySchema = z.object({
  dateFrom: z.string().regex(datePattern, 'dateFrom must be YYYY-MM-DD'),
  dateTo: z.string().regex(datePattern, 'dateTo must be YYYY-MM-DD'),
  class: z.string().optional(),
});

type TransactionRow = {
  id: string;
  amount_paid: number | string;
  fee_type: string | null;
  payment_date: string;
  students:
    | {
        class: string | null;
        section: string | null;
      }
    | Array<{
        class: string | null;
        section: string | null;
      }>
    | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const today = new Date();
  const defaultDateTo = today.toISOString().slice(0, 10);
  const defaultDateFrom = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  return reportQuerySchema.safeParse({
    dateFrom: searchParams.get('dateFrom') || defaultDateFrom,
    dateTo: searchParams.get('dateTo') || defaultDateTo,
    class: searchParams.get('class') || undefined,
  });
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(['admin', 'accountant']);
    if ('response' in authorization) {
      return authorization.response;
    }

    const { supabase, profile } = authorization;
    const query = resolveDateRange(request);

    if (!query.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: query.error.issues.map((issue) => issue.message),
        },
        { status: 400 }
      );
    }

    const selectedClass = (query.data.class || 'all').trim();

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(
        `
          id,
          amount_paid,
          fee_type,
          payment_date,
          students:student_id(
            class,
            section
          )
        `
      )
      .eq('school_id', profile.school_id)
      .gte('payment_date', query.data.dateFrom)
      .lte('payment_date', query.data.dateTo)
      .order('payment_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (transactions || []) as TransactionRow[];
    const filteredRows = rows.filter((row) => {
      if (!selectedClass || selectedClass.toLowerCase() === 'all') {
        return true;
      }

      const student = Array.isArray(row.students)
        ? row.students[0] || null
        : row.students;
      return (student?.class || '').trim() === selectedClass;
    });

    const totalAmount = filteredRows.reduce(
      (sum, row) => sum + toNumber(row.amount_paid),
      0
    );

    const byFeeTypeMap = new Map<string, { count: number; amount: number }>();
    const byClassMap = new Map<string, { count: number; amount: number }>();
    const byDateMap = new Map<string, { count: number; amount: number }>();

    for (const row of filteredRows) {
      const amount = toNumber(row.amount_paid);
      const feeType = row.fee_type || 'Unspecified';
      const student = Array.isArray(row.students)
        ? row.students[0] || null
        : row.students;
      const classLabel = [student?.class, student?.section]
        .filter(Boolean)
        .join('-') || 'Unknown';

      const feeTypeEntry = byFeeTypeMap.get(feeType) || { count: 0, amount: 0 };
      feeTypeEntry.count += 1;
      feeTypeEntry.amount += amount;
      byFeeTypeMap.set(feeType, feeTypeEntry);

      const classEntry = byClassMap.get(classLabel) || { count: 0, amount: 0 };
      classEntry.count += 1;
      classEntry.amount += amount;
      byClassMap.set(classLabel, classEntry);

      const dateEntry = byDateMap.get(row.payment_date) || { count: 0, amount: 0 };
      dateEntry.count += 1;
      dateEntry.amount += amount;
      byDateMap.set(row.payment_date, dateEntry);
    }

    return NextResponse.json({
      range: {
        dateFrom: query.data.dateFrom,
        dateTo: query.data.dateTo,
        class: selectedClass,
      },
      summary: {
        transactionCount: filteredRows.length,
        totalAmount,
      },
      byFeeType: Array.from(byFeeTypeMap.entries()).map(([feeType, stats]) => ({
        feeType,
        count: stats.count,
        amount: stats.amount,
      })),
      byClass: Array.from(byClassMap.entries()).map(([className, stats]) => ({
        class: className,
        count: stats.count,
        amount: stats.amount,
      })),
      byDate: Array.from(byDateMap.entries()).map(([date, stats]) => ({
        date,
        count: stats.count,
        amount: stats.amount,
      })),
    });
  } catch (error) {
    console.error('Collection summary API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
