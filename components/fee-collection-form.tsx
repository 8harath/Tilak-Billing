'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Printer, X } from 'lucide-react';

interface StudentRecord {
  id: string;
  name: string;
  roll_number: string;
  class: string | null;
  section: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
}

interface FeeStructureRecord {
  id: string;
  name: string;
  amount: number | string;
  class: string | null;
}

interface SelectedFee {
  feeStructureId: string | null;
  type: string;
  amount: number;
}

interface TransactionItemRecord {
  id: string;
  fee_structure_id: string | null;
  description: string;
  amount: number | string;
}

interface TransactionResponse {
  id?: string;
  receipt_number: string;
  payment_date: string;
  amount_paid: number | string;
  notes?: string | null;
  students?: StudentRecord | null;
  transaction_items?: TransactionItemRecord[];
}

interface ReceiptData {
  receiptNumber: string;
  date: string;
  student: {
    name: string;
    admissionNo: string;
    classLabel: string;
    roll: string;
    guardianInfo: string;
  };
  fees: Array<{ type: string; amount: number }>;
  total: number;
  notes: string;
}

const CLASS_OPTIONS = [
  'All',
  'Pre-Nursery',
  'Nursery',
  'LKG',
  'UKG',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
];

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatClassLabel(student: StudentRecord | null): string {
  if (!student) return '-';
  return [student.class, student.section].filter(Boolean).join('-') || '-';
}

function buildReceiptData(
  transaction: TransactionResponse | null,
  selectedStudent: StudentRecord,
  selectedFees: SelectedFee[],
  paymentDate: string,
  notes: string
): ReceiptData {
  const studentFromTx = transaction?.students || selectedStudent;
  const itemsFromTx = transaction?.transaction_items || [];
  const feeRows =
    itemsFromTx.length > 0
      ? itemsFromTx.map((item) => ({
          type: item.description,
          amount: toNumber(item.amount),
        }))
      : selectedFees.map((fee) => ({
          type: fee.type,
          amount: fee.amount,
        }));

  const totalAmount =
    transaction && transaction.amount_paid !== undefined
      ? toNumber(transaction.amount_paid)
      : feeRows.reduce((sum, fee) => sum + fee.amount, 0);

  const paymentDateLabel = new Date(
    `${transaction?.payment_date || paymentDate}T00:00:00`
  ).toLocaleDateString('en-IN');

  return {
    receiptNumber: transaction?.receipt_number || `RCP-${Date.now()}`,
    date: paymentDateLabel,
    student: {
      name: studentFromTx.name,
      admissionNo: studentFromTx.roll_number,
      classLabel:
        [studentFromTx.class, studentFromTx.section].filter(Boolean).join('-') ||
        '-',
      roll: studentFromTx.roll_number,
      guardianInfo:
        studentFromTx.parent_phone || studentFromTx.parent_email || 'N/A',
    },
    fees: feeRows,
    total: totalAmount,
    notes: transaction?.notes || notes || '',
  };
}

export function FeeCollectionForm() {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(
    null
  );

  const [availableFees, setAvailableFees] = useState<FeeStructureRecord[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesError, setFeesError] = useState('');
  const [selectedFees, setSelectedFees] = useState<SelectedFee[]>([]);

  const [customFeeName, setCustomFeeName] = useState('');
  const [customFeeAmount, setCustomFeeAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const totalAmount = useMemo(
    () => selectedFees.reduce((sum, fee) => sum + fee.amount, 0),
    [selectedFees]
  );

  const loadStudents = useCallback(async (query: string, selectedClass: string) => {
    setStudentsLoading(true);
    setStudentsError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set('q', query.trim());
      }
      if (selectedClass && selectedClass !== 'All') {
        params.set('class', selectedClass);
      }
      params.set('limit', '30');

      const response = await fetch(`/api/students?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load students');
      }

      const data = (await response.json()) as StudentRecord[];
      setStudents(data);
    } catch (error) {
      setStudents([]);
      setStudentsError(
        error instanceof Error ? error.message : 'Failed to load students'
      );
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const loadFeeStructures = useCallback(async (studentClass: string | null) => {
    setFeesLoading(true);
    setFeesError('');
    try {
      const params = new URLSearchParams();
      if (studentClass) {
        params.set('class', studentClass);
      }

      const response = await fetch(`/api/fee-structures?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load fee structures');
      }

      const data = (await response.json()) as FeeStructureRecord[];
      setAvailableFees(data);
    } catch (error) {
      setAvailableFees([]);
      setFeesError(
        error instanceof Error ? error.message : 'Failed to load fee structures'
      );
    } finally {
      setFeesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    const timer = setTimeout(() => {
      void loadStudents(searchQuery, classFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [classFilter, loadStudents, searchQuery, step]);

  useEffect(() => {
    if (step !== 2 || !selectedStudent) return;
    void loadFeeStructures(selectedStudent.class);
  }, [loadFeeStructures, selectedStudent, step]);

  const handleSelectStudent = (student: StudentRecord) => {
    setSelectedStudent(student);
    setSearchQuery(student.name);
    setShowSearchDropdown(false);
    setSelectedFees([]);
    setFormError('');
    setStep(2);
  };

  const handleAddFee = (fee: FeeStructureRecord) => {
    const alreadyAdded = selectedFees.some(
      (selected) => selected.feeStructureId === fee.id
    );
    if (alreadyAdded) return;

    setSelectedFees((current) => [
      ...current,
      {
        feeStructureId: fee.id,
        type: fee.name,
        amount: toNumber(fee.amount),
      },
    ]);
  };

  const handleAddCustomFee = () => {
    const trimmedName = customFeeName.trim();
    const amount = Number(customFeeAmount);
    if (!trimmedName || !Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a valid custom fee name and amount');
      return;
    }

    setSelectedFees((current) => [
      ...current,
      {
        feeStructureId: null,
        type: trimmedName,
        amount,
      },
    ]);
    setCustomFeeName('');
    setCustomFeeAmount('');
    setFormError('');
  };

  const handleRemoveFee = (index: number) => {
    setSelectedFees((current) => current.filter((_, i) => i !== index));
  };

  const handleUpdateFeeAmount = (index: number, amount: number) => {
    setSelectedFees((current) =>
      current.map((fee, i) =>
        i === index
          ? {
              ...fee,
              amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
            }
          : fee
      )
    );
  };

  const handleGenerateReceipt = async () => {
    if (!selectedStudent) {
      setFormError('Please select a student');
      return;
    }
    if (selectedFees.length === 0) {
      setFormError('Please add at least one fee item');
      return;
    }
    if (!paymentDate) {
      setFormError('Please select payment date');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        studentId: selectedStudent.id,
        paymentDate,
        notes,
        items: selectedFees.map((fee) => ({
          feeStructureId: fee.feeStructureId,
          description: fee.type,
          amount: fee.amount,
        })),
      };

      const createResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        const details = Array.isArray(errorData.details)
          ? `: ${errorData.details.join(', ')}`
          : '';
        throw new Error((errorData.error || 'Failed to create transaction') + details);
      }

      let createdTransaction =
        (await createResponse.json()) as TransactionResponse | null;

      if (createdTransaction?.receipt_number) {
        const txResponse = await fetch(
          `/api/transactions?receiptNumber=${encodeURIComponent(
            createdTransaction.receipt_number
          )}`
        );
        if (txResponse.ok) {
          createdTransaction = (await txResponse.json()) as TransactionResponse;
        }
      }

      setReceiptData(
        buildReceiptData(
          createdTransaction,
          selectedStudent,
          selectedFees,
          paymentDate,
          notes
        )
      );
      setStep(3);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Failed to generate receipt'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white print:hidden">
        <div className="max-w-2xl mx-auto p-6">
          <Card className="p-8 shadow-lg">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Fee Collection
              </h1>
              <p className="text-lg text-gray-600">Step 1 of 3: Search Student</p>
            </div>

            {studentsError && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {studentsError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Filter by Class
                </p>
                <select
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                >
                  {CLASS_OPTIONS.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </div>

              <label className="block">
                <p className="text-lg font-semibold text-gray-900 mb-3">
                  Find Student (Name / Roll Number)
                </p>
                <div className="relative">
                  <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Type student name or roll number..."
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setShowSearchDropdown(true);
                    }}
                    onFocus={() => setShowSearchDropdown(true)}
                    className="pl-12 py-3 text-lg"
                  />
                </div>

                {showSearchDropdown && (
                  <div className="absolute top-full left-6 right-6 bg-white border-2 border-blue-300 rounded-lg shadow-lg mt-2 z-50 max-h-64 overflow-y-auto">
                    {studentsLoading ? (
                      <div className="px-4 py-4 text-sm text-gray-600">
                        Loading students...
                      </div>
                    ) : students.length > 0 ? (
                      students.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => handleSelectStudent(student)}
                          className="w-full text-left px-4 py-4 hover:bg-blue-50 border-b last:border-b-0 transition"
                        >
                          <div className="font-bold text-lg text-gray-900">
                            {student.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            Roll {student.roll_number} | Class{' '}
                            {formatClassLabel(student)}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-sm text-gray-600">
                        No students found
                      </div>
                    )}
                  </div>
                )}
              </label>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white print:hidden">
        <div className="max-w-3xl mx-auto p-6">
          <Card className="p-8 shadow-lg">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Fee Collection
              </h1>
              <p className="text-lg text-gray-600">Step 2 of 3: Select Fees</p>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {feesError && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {feesError}
              </div>
            )}

            <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-6 mb-8">
              <p className="text-sm text-blue-600 mb-1">Selected Student</p>
              <h2 className="text-3xl font-bold text-blue-900">
                {selectedStudent?.name}
              </h2>
              <p className="text-blue-700 mt-2">
                Roll {selectedStudent?.roll_number} | Class{' '}
                {formatClassLabel(selectedStudent)}
              </p>
            </div>

            <p className="text-lg font-bold text-gray-900 mb-4">Available Fees:</p>
            <div className="grid grid-cols-1 gap-3 mb-6">
              {feesLoading ? (
                <div className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-600">
                  Loading fee structures...
                </div>
              ) : availableFees.length > 0 ? (
                availableFees.map((fee) => (
                  <button
                    key={fee.id}
                    onClick={() => handleAddFee(fee)}
                    className="text-left p-4 bg-gray-50 hover:bg-gray-100 border-2 border-gray-300 hover:border-blue-400 rounded-lg transition font-semibold text-lg"
                  >
                    {fee.name}{' '}
                    <span className="float-right text-blue-600">
                      Rs {toNumber(fee.amount).toFixed(2)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-600">
                  No fee structures found for this class. Add custom line items
                  below.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-300 p-4 mb-8 bg-white">
              <p className="text-base font-semibold text-gray-900 mb-3">
                Add Custom Fee Item
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                <Input
                  placeholder="Fee name"
                  value={customFeeName}
                  onChange={(event) => setCustomFeeName(event.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={customFeeAmount}
                  onChange={(event) => setCustomFeeAmount(event.target.value)}
                />
                <Button type="button" onClick={handleAddCustomFee}>
                  Add Custom Fee
                </Button>
              </div>
            </div>

            {selectedFees.length > 0 && (
              <div className="space-y-4 mb-8">
                <p className="text-lg font-bold text-gray-900">Selected Fees:</p>
                {selectedFees.map((fee, index) => (
                  <div
                    key={`${fee.type}-${index}`}
                    className="flex gap-4 items-center bg-green-50 p-4 rounded-lg border border-green-300"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{fee.type}</p>
                    </div>
                    <Input
                      type="number"
                      value={fee.amount}
                      onChange={(event) =>
                        handleUpdateFeeAmount(
                          index,
                          Number.parseFloat(event.target.value) || 0
                        )
                      }
                      className="w-40 text-right text-lg"
                    />
                    <button
                      onClick={() => handleRemoveFee(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Payment Date
                </p>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Notes</p>
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="bg-green-100 border-4 border-green-600 rounded-lg p-6 mb-8">
              <p className="text-sm text-green-700 mb-2">Total Amount</p>
              <h3 className="text-4xl font-bold text-green-900">
                Rs {totalAmount.toFixed(2)}
              </h3>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setStep(1);
                  setShowSearchDropdown(false);
                }}
                variant="outline"
                className="flex-1 py-3 text-lg"
              >
                Back
              </Button>
              <Button
                onClick={handleGenerateReceipt}
                disabled={selectedFees.length === 0 || submitting}
                className="flex-1 py-3 text-lg bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? 'Saving...' : 'Generate Receipt'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 3 && receiptData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="no-print bg-white border-b border-gray-300 p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Receipt Preview</h1>
          <div className="flex gap-4">
            <Button onClick={() => setStep(2)} variant="outline">
              Back to Fees
            </Button>
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4 mr-2" /> Print to PDF
            </Button>
          </div>
        </div>

        <div ref={receiptRef} className="bg-white">
          <style>{`
            @media print {
              .no-print { display: none !important; }
              body { margin: 0; padding: 0; background: white; }
              .receipt-copy {
                width: 100%;
                height: 5.5in;
                padding: 0.5in;
                box-sizing: border-box;
                page-break-inside: avoid;
              }
            }
          `}</style>

          <div className="receipt-copy border-b-4 border-dashed border-gray-400 p-8 min-h-screen flex flex-col">
            <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
              <h1 className="text-2xl font-bold">Tilak School</h1>
              <p className="text-xs text-gray-700">1st Main 10th Cross, Mangammanapalya</p>
              <p className="text-xs text-gray-700">Bengaluru - 560068</p>
              <p className="text-xs text-gray-700">+91 98458 03977 | info@tilakschools.com</p>
            </div>

            <div className="text-center mb-4 text-sm font-bold bg-gray-200 py-2">
              MANAGEMENT COPY
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-6">
              <div>
                <p className="text-gray-600">RECEIPT NO.</p>
                <p className="font-bold text-lg">{receiptData.receiptNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-600">DATE</p>
                <p className="font-bold text-lg">{receiptData.date}</p>
              </div>
            </div>

            <div className="bg-gray-100 p-4 mb-6 rounded text-xs">
              <p className="font-bold mb-2">STUDENT INFORMATION</p>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="font-bold">Name:</td>
                    <td>{receiptData.student.name}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">Admission:</td>
                    <td>{receiptData.student.admissionNo}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">Class:</td>
                    <td>{receiptData.student.classLabel}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">Roll:</td>
                    <td>{receiptData.student.roll}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">Guardian:</td>
                    <td>{receiptData.student.guardianInfo}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="font-bold text-xs mb-2">FEE DETAILS:</p>
            <table className="w-full text-xs mb-6 border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.fees.map((fee, index) => (
                  <tr key={`${fee.type}-${index}`} className="border-b border-gray-300">
                    <td className="py-2">{fee.type}</td>
                    <td className="text-right py-2">Rs {fee.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {receiptData.notes && (
              <div className="text-xs bg-yellow-50 border border-yellow-300 rounded p-3 mb-4">
                <span className="font-bold">Notes:</span> {receiptData.notes}
              </div>
            )}

            <div className="bg-green-100 border-2 border-green-800 p-4 mb-6 rounded flex justify-between items-center">
              <span className="font-bold">TOTAL PAID:</span>
              <span className="text-2xl font-bold">
                Rs {receiptData.total.toFixed(2)}
              </span>
            </div>

            <div className="flex-1"></div>

            <div className="border-t-2 border-gray-800 pt-4 text-xs">
              <div className="grid grid-cols-2 gap-8 text-center">
                <div>
                  <div className="mb-8 h-12" />
                  <p className="font-bold">Staff Signature</p>
                </div>
                <div>
                  <div className="mb-8 h-12" />
                  <p className="font-bold">Authorised Signatory</p>
                </div>
              </div>
            </div>
          </div>

          <div className="receipt-copy p-8 min-h-screen flex flex-col">
            <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
              <h1 className="text-2xl font-bold">Tilak School</h1>
              <p className="text-xs text-gray-700">1st Main 10th Cross, Mangammanapalya</p>
              <p className="text-xs text-gray-700">Bengaluru - 560068</p>
              <p className="text-xs text-gray-700">+91 98458 03977 | info@tilakschools.com</p>
            </div>

            <div className="text-center mb-4 text-sm font-bold bg-gray-200 py-2">
              PARENT COPY
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-6">
              <div>
                <p className="text-gray-600">RECEIPT NO.</p>
                <p className="font-bold text-lg">{receiptData.receiptNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-600">DATE</p>
                <p className="font-bold text-lg">{receiptData.date}</p>
              </div>
            </div>

            <div className="bg-gray-100 p-4 mb-6 rounded text-xs">
              <p className="font-bold mb-2">STUDENT INFORMATION</p>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="font-bold">Name:</td>
                    <td>{receiptData.student.name}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">Admission:</td>
                    <td>{receiptData.student.admissionNo}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">Class:</td>
                    <td>{receiptData.student.classLabel}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="font-bold text-xs mb-2">FEE DETAILS:</p>
            <table className="w-full text-xs mb-6 border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.fees.map((fee, index) => (
                  <tr key={`${fee.type}-${index}`} className="border-b border-gray-300">
                    <td className="py-2">{fee.type}</td>
                    <td className="text-right py-2">Rs {fee.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-green-100 border-2 border-green-800 p-4 mb-6 rounded flex justify-between items-center">
              <span className="font-bold">TOTAL PAID:</span>
              <span className="text-2xl font-bold">
                Rs {receiptData.total.toFixed(2)}
              </span>
            </div>

            <div className="flex-1"></div>

            <div className="border-t-2 border-gray-800 pt-4 text-xs text-center">
              <p className="text-gray-700">Thank you for your payment</p>
              <p className="text-gray-700 mt-2">This is a computer-generated receipt</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
