'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Printer, X } from 'lucide-react';

const STUDENTS = [
  { id: '1', name: 'Arun Kumar', admissionNo: 'ADM-2024-001', class: '10A', roll: '01', fatherName: 'Krishnan' },
  { id: '2', name: 'Anjali Reddy', admissionNo: 'ADM-2024-002', class: '10A', roll: '02', fatherName: 'Rajesh Reddy' },
  { id: '3', name: 'Ashok Patel', admissionNo: 'ADM-2024-003', class: '9B', roll: '03', fatherName: 'Vikram Patel' },
  { id: '4', name: 'Anand Gupta', admissionNo: 'ADM-2024-004', class: '10B', roll: '04', fatherName: 'Rajendra Gupta' },
  { id: '5', name: 'Arpita Sharma', admissionNo: 'ADM-2024-005', class: '9A', roll: '05', fatherName: 'Ramesh Sharma' },
  { id: '6', name: 'Akshara Menon', admissionNo: 'ADM-2024-006', class: '10A', roll: '06', fatherName: 'Suresh Menon' },
  { id: '7', name: 'Arjun Singh', admissionNo: 'ADM-2024-007', class: '9B', roll: '07', fatherName: 'Rajeev Singh' },
  { id: '8', name: 'Amrita Iyer', admissionNo: 'ADM-2024-008', class: '10B', roll: '08', fatherName: 'Srinivasan Iyer' },
  { id: '9', name: 'Aditya Nair', admissionNo: 'ADM-2024-009', class: '9A', roll: '09', fatherName: 'Prakash Nair' },
  { id: '10', name: 'Avni Desai', admissionNo: 'ADM-2024-010', class: '10A', roll: '10', fatherName: 'Rajesh Desai' },
];

const FEE_TYPES = [
  { name: 'Tuition Fee', defaultAmount: 50000 },
  { name: 'Exam Fee', defaultAmount: 1000 },
  { name: 'Transport Fee', defaultAmount: 5000 },
  { name: 'Sports Fee', defaultAmount: 2000 },
  { name: 'Lab Fee', defaultAmount: 1500 },
];

export function FeeCollectionForm() {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Step 1: Student Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<typeof STUDENTS[0] | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  
  // Step 2: Fee Selection
  const [selectedFees, setSelectedFees] = useState<{ type: string; amount: number }[]>([]);
  
  // Step 3: Receipt
  const [receiptData, setReceiptData] = useState<any>(null);

  const filteredStudents = searchQuery.trim() 
    ? STUDENTS.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admissionNo.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectStudent = (student: typeof STUDENTS[0]) => {
    setSelectedStudent(student);
    setSearchQuery(student.name);
    setShowSearchDropdown(false);
    setStep(2);
  };

  const handleAddFee = (feeType: typeof FEE_TYPES[0]) => {
    setSelectedFees([...selectedFees, { type: feeType.name, amount: feeType.defaultAmount }]);
  };

  const handleRemoveFee = (index: number) => {
    setSelectedFees(selectedFees.filter((_, i) => i !== index));
  };

  const handleUpdateFeeAmount = (index: number, amount: number) => {
    const updated = [...selectedFees];
    updated[index].amount = amount;
    setSelectedFees(updated);
  };

  const totalAmount = selectedFees.reduce((sum, fee) => sum + fee.amount, 0);

  const handleGenerateReceipt = () => {
    if (!selectedStudent || selectedFees.length === 0) {
      alert('Please select student and add fees');
      return;
    }

    const receiptNumber = `RCP-${Date.now()}`;
    setReceiptData({
      receiptNumber,
      date: new Date().toLocaleDateString('en-IN'),
      student: selectedStudent,
      fees: selectedFees,
      total: totalAmount,
    });
    setStep(3);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setStep(1);
    setSearchQuery('');
    setSelectedStudent(null);
    setSelectedFees([]);
    setReceiptData(null);
  };

  // ===== STEP 1: STUDENT SEARCH =====
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white print:hidden">
        <div className="max-w-2xl mx-auto p-6">
          <Card className="p-8 shadow-lg">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Fee Collection</h1>
              <p className="text-lg text-gray-600">Step 1 of 3: Search Student</p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <p className="text-lg font-semibold text-gray-900 mb-3">Find Student</p>
                <div className="relative">
                  <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Type name or admission number..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearchDropdown(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowSearchDropdown(searchQuery.length > 0)}
                    className="pl-12 py-3 text-lg"
                  />
                </div>

                {showSearchDropdown && filteredStudents.length > 0 && (
                  <div className="absolute top-full left-6 right-6 bg-white border-2 border-blue-300 rounded-lg shadow-lg mt-2 z-50 max-h-64 overflow-y-auto">
                    {filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        onClick={() => handleSelectStudent(student)}
                        className="w-full text-left px-4 py-4 hover:bg-blue-50 border-b last:border-b-0 transition"
                      >
                        <div className="font-bold text-lg text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-600">
                          {student.admissionNo} | Class {student.class} | Roll {student.roll}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </label>

              {!selectedStudent && filteredStudents.length === 0 && searchQuery && (
                <p className="text-red-600 text-center">No students found</p>
              )}

              {searchQuery && filteredStudents.length === 0 && !selectedStudent && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 text-yellow-800">
                  Start typing to search for students
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ===== STEP 2: FEE SELECTION =====
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white print:hidden">
        <div className="max-w-2xl mx-auto p-6">
          <Card className="p-8 shadow-lg">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Fee Collection</h1>
              <p className="text-lg text-gray-600">Step 2 of 3: Select Fees</p>
            </div>

            {/* Selected Student Display */}
            <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-6 mb-8">
              <p className="text-sm text-blue-600 mb-1">Selected Student</p>
              <h2 className="text-3xl font-bold text-blue-900">{selectedStudent?.name}</h2>
              <p className="text-blue-700 mt-2">{selectedStudent?.admissionNo} | Class {selectedStudent?.class}</p>
            </div>

            {/* Available Fees */}
            <p className="text-lg font-bold text-gray-900 mb-4">Click to add fees:</p>
            <div className="grid grid-cols-1 gap-3 mb-8">
              {FEE_TYPES.map((fee) => (
                <button
                  key={fee.name}
                  onClick={() => handleAddFee(fee)}
                  className="text-left p-4 bg-gray-50 hover:bg-gray-100 border-2 border-gray-300 hover:border-blue-400 rounded-lg transition font-semibold text-lg"
                >
                  {fee.name} <span className="float-right text-blue-600">Rs {fee.defaultAmount}</span>
                </button>
              ))}
            </div>

            {/* Selected Fees */}
            {selectedFees.length > 0 && (
              <div className="space-y-4 mb-8">
                <p className="text-lg font-bold text-gray-900">Selected Fees:</p>
                {selectedFees.map((fee, idx) => (
                  <div key={idx} className="flex gap-4 items-center bg-green-50 p-4 rounded-lg border border-green-300">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{fee.type}</p>
                    </div>
                    <Input
                      type="number"
                      value={fee.amount}
                      onChange={(e) => handleUpdateFeeAmount(idx, parseFloat(e.target.value) || 0)}
                      className="w-32 text-right text-lg"
                    />
                    <button
                      onClick={() => handleRemoveFee(idx)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Total Amount */}
            <div className="bg-green-100 border-4 border-green-600 rounded-lg p-6 mb-8">
              <p className="text-sm text-green-700 mb-2">Total Amount</p>
              <h3 className="text-4xl font-bold text-green-900">Rs {totalAmount.toFixed(2)}</h3>
            </div>

            {/* Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 py-3 text-lg"
              >
                Back
              </Button>
              <Button
                onClick={handleGenerateReceipt}
                disabled={selectedFees.length === 0}
                className="flex-1 py-3 text-lg bg-blue-600 hover:bg-blue-700"
              >
                Generate Receipt
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ===== STEP 3: RECEIPT PREVIEW =====
  if (step === 3 && receiptData) {
    return (
      <div className="min-h-screen bg-white">
        {/* Toolbar for Print/Back (Hidden on Print) */}
        <div className="no-print bg-white border-b border-gray-300 p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Receipt Preview</h1>
          <div className="flex gap-4">
            <Button onClick={() => setStep(2)} variant="outline">Back to Fees</Button>
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4 mr-2" /> Print to PDF
            </Button>
          </div>
        </div>

        {/* Receipt Content - Dual Copy for A4 */}
        <div ref={receiptRef} className="bg-white">
          <style>{`
            @media print {
              .no-print { display: none !important; }
              body { margin: 0; padding: 0; background: white; }
              .receipt-page { page-break-inside: avoid; }
              .receipt-copy { 
                width: 100%;
                height: 5.5in;
                padding: 0.5in;
                page-break-inside: avoid;
                box-sizing: border-box;
              }
            }
          `}</style>

          {/* Receipt Copy 1 */}
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
                  <tr><td className="font-bold">Name:</td><td>{receiptData.student.name}</td></tr>
                  <tr><td className="font-bold">Admission:</td><td>{receiptData.student.admissionNo}</td></tr>
                  <tr><td className="font-bold">Class:</td><td>{receiptData.student.class}</td></tr>
                  <tr><td className="font-bold">Roll:</td><td>{receiptData.student.roll}</td></tr>
                  <tr><td className="font-bold">Father/Guardian:</td><td>{receiptData.student.fatherName}</td></tr>
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
                {receiptData.fees.map((fee: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-300">
                    <td className="py-2">{fee.type}</td>
                    <td className="text-right py-2">Rs {fee.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-green-100 border-2 border-green-800 p-4 mb-6 rounded flex justify-between items-center">
              <span className="font-bold">TOTAL PAID:</span>
              <span className="text-2xl font-bold">Rs {receiptData.total.toFixed(2)}</span>
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

          {/* Receipt Copy 2 */}
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
                  <tr><td className="font-bold">Name:</td><td>{receiptData.student.name}</td></tr>
                  <tr><td className="font-bold">Admission:</td><td>{receiptData.student.admissionNo}</td></tr>
                  <tr><td className="font-bold">Class:</td><td>{receiptData.student.class}</td></tr>
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
                {receiptData.fees.map((fee: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-300">
                    <td className="py-2">{fee.type}</td>
                    <td className="text-right py-2">Rs {fee.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-green-100 border-2 border-green-800 p-4 mb-6 rounded flex justify-between items-center">
              <span className="font-bold">TOTAL PAID:</span>
              <span className="text-2xl font-bold">Rs {receiptData.total.toFixed(2)}</span>
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

