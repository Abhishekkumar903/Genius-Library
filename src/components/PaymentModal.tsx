import React, { useState } from "react";
import { X, Wallet, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../constants";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  token: string;
  onSuccess: (data: any) => void;
}

export default function PaymentModal({ isOpen, onClose, student, token, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  // Set default next due date to 1 month from current due date
  useState(() => {
    if (student) {
      setAmount(student.fees_amount.toString());
      const currentDue = new Date(student.due_date);
      const nextDue = new Date(currentDue.setMonth(currentDue.getMonth() + 1));
      setNextDueDate(nextDue.toISOString().slice(0, 10));
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: student.id,
          amount: parseFloat(amount),
          date: new Date().toISOString().slice(0, 10),
          next_due_date: nextDueDate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess({
          ...data,
          student,
          amount: parseFloat(amount),
          date: new Date().toISOString().slice(0, 10),
          nextDueDate
        });
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900">Collect Payment</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-1">Student</p>
              <p className="font-bold text-slate-900">{student.name}</p>
              <p className="text-sm text-slate-600">Seat: {student.seat_id} | Mobile: {student.mobile}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Amount Paid (₹)
                </label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Next Due Date
                </label>
                <input
                  type="date"
                  required
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Confirm Payment"}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
