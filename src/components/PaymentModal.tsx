import React, { useState, useEffect } from "react";
import { X, Wallet, Calendar, Calculator, Clock, CreditCard, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../constants";
import { calculateLateFee, getStudentRoom } from "../services/feeUtils";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  token: string;
  onSuccess: (data: any) => void;
}

export default function PaymentModal({ isOpen, onClose, student, token, onSuccess }: PaymentModalProps) {
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "advance">("full");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Bank Transfer">("UPI");
  const [billingMonth, setBillingMonth] = useState<string>("");
  const [originalFee, setOriginalFee] = useState<number>(0);
  const [customLateFee, setCustomLateFee] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [nextDueDate, setNextDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (student && isOpen) {
      const baseFee = student.fees_amount || 800;
      setOriginalFee(baseFee);

      // Default Billing Month
      const currentMonthName = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
      setBillingMonth(currentMonthName);

      // Late fee calculation
      const { daysLate, lateFee } = calculateLateFee(student.due_date);
      setCustomLateFee(lateFee.toString());

      const totalFeeDue = baseFee + lateFee;
      setAmountPaid(totalFeeDue.toString());

      // Set default next due date to 1 month from current due date
      const currentDue = new Date(student.due_date || new Date());
      const nextDue = new Date(currentDue.setMonth(currentDue.getMonth() + 1));
      setNextDueDate(nextDue.toISOString().slice(0, 10));

      setPaymentType("full");
      setPaymentMethod("UPI");
      setNotes("");
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const lateFeeVal = parseFloat(customLateFee) || 0;
  const totalDueVal = originalFee + lateFeeVal;
  const paidVal = parseFloat(amountPaid) || 0;
  const balanceRemaining = Math.max(0, totalDueVal - paidVal);

  const { daysLate } = calculateLateFee(student.due_date);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        student_id: student.id,
        amount: paidVal,
        original_fee: originalFee,
        late_fee: lateFeeVal,
        total_due: totalDueVal,
        balance_remaining: balanceRemaining,
        date: new Date().toISOString().slice(0, 10),
        method: paymentMethod,
        payment_type: paymentType,
        billing_month: billingMonth,
        next_due_date: nextDueDate,
        notes: notes,
      };

      const res = await fetch(`${API_BASE_URL}/api/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess({
          ...data,
          invoice_id: data.invoice_id || `INV-${Date.now()}`,
          student,
          amount: paidVal,
          original_fee: originalFee,
          late_fee: lateFeeVal,
          total_due: totalDueVal,
          balance_remaining: balanceRemaining,
          date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          method: paymentMethod,
          payment_type: paymentType,
          billing_month: billingMonth,
          nextDueDate,
          notes,
        });
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Collect Fee Payment</h2>
                <p className="text-xs text-slate-500">Monthly Fee & Late Charge Calculator</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
            {/* Student Info Card */}
            <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-100/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Student Profile</p>
                  <p className="font-bold text-slate-900 text-base">{student.name}</p>
                </div>
                <span className="px-2.5 py-1 bg-white text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                  {getStudentRoom(student.seat_id, student.room)} • Seat {student.seat_id}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1 border-t border-indigo-100/60">
                <span>Mobile: <strong>{student.mobile}</strong></span>
                <span>Due Date: <strong>{student.due_date}</strong></span>
                <span>Shift: <strong>{student.timing}</strong></span>
              </div>
            </div>

            {/* Payment Type Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Category</label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentType("full");
                    setAmountPaid(totalDueVal.toString());
                  }}
                  className={`py-2 rounded-lg transition-all ${paymentType === "full" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Full Payment
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("partial")}
                  className={`py-2 rounded-lg transition-all ${paymentType === "partial" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Partial Payment
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("advance")}
                  className={`py-2 rounded-lg transition-all ${paymentType === "advance" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Advance Payment
                </button>
              </div>
            </div>

            {/* Fee Breakdown & Late Fee Calculation */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-indigo-600" /> Late Fee Calculation Logic
                </span>
                {daysLate > 0 ? (
                  <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {daysLate} Day(s) Overdue
                  </span>
                ) : (
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                    On Time (₹0 Late Fee)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-500 font-medium">Original Monthly Fee (₹)</label>
                  <input
                    type="number"
                    value={originalFee}
                    onChange={(e) => setOriginalFee(parseFloat(e.target.value) || 0)}
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-500 font-medium">Late Fee Auto-Calculated (₹)</label>
                  <input
                    type="number"
                    value={customLateFee}
                    onChange={(e) => setCustomLateFee(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-rose-600 font-bold outline-none"
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-amber-50/80 p-2 rounded-lg border border-amber-100/80">
                💡 Late Fee Rules: 1–7 days late = ₹20 | 8–15 days late = ₹50 | &gt;15 days = ₹100
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold">
                <span className="text-slate-700">Total Amount Due:</span>
                <span className="text-slate-900 text-base">₹{totalDueVal}</span>
              </div>
            </div>

            {/* Payment Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" /> Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="UPI">UPI Payment</option>
                  <option value="Cash">Cash Desk</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Billing Month
                </label>
                <input
                  type="text"
                  required
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  placeholder="e.g. August 2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Amount Paid & Remaining Balance */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Amount Now Paying (₹)</label>
                <input
                  type="number"
                  required
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 text-emerald-800 font-bold rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Remaining Balance (₹)</label>
                <div className={`w-full px-3 py-2 rounded-xl text-xs font-bold border ${balanceRemaining > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                  ₹{balanceRemaining}
                </div>
              </div>
            </div>

            {/* Next Due Date & Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Next Due Date
                </label>
                <input
                  type="date"
                  required
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" /> Notes / Txn Ref
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. UPI Ref #98231"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              {loading ? "Recording Payment..." : `Confirm Payment of ₹${paidVal}`}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
