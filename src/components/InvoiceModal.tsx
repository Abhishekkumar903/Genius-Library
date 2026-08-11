import { X, Download, CheckCircle2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generatePDFReceipt, getStudentRoom, PaymentRecord } from "../services/feeUtils";

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
}

export default function InvoiceModal({ isOpen, onClose, data }: InvoiceModalProps) {
  if (!isOpen || !data) return null;

  const paymentRecord: PaymentRecord = {
    invoice_id: data.invoice_id || `INV-${Date.now()}`,
    student_id: data.student?.id || 0,
    amount: data.amount || 0,
    original_fee: data.original_fee || data.student?.fees_amount || 0,
    late_fee: data.late_fee || 0,
    total_due: data.total_due || data.amount || 0,
    balance_remaining: data.balance_remaining || 0,
    date: data.date || new Date().toISOString().slice(0, 10),
    method: data.method || "UPI",
    payment_type: data.payment_type || "full",
    payment_status: "Paid",
    billing_month: data.billing_month || new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
    notes: data.notes || "",
  };

  const handleDownloadPDF = () => {
    generatePDFReceipt(paymentRecord, data.student);
  };

  const roomName = getStudentRoom(data.student?.seat_id, data.student?.room);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-base">G</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Genius Library Official Receipt</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Success Banner */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-md shadow-emerald-200">
                <CheckCircle2 className="text-white w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-emerald-900">Payment Processed Successfully</h3>
              <p className="text-xs text-emerald-700 font-medium">
                Receipt #{paymentRecord.invoice_id} • {paymentRecord.date}
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3 bg-slate-50/50 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Student Name</span>
                <span className="font-bold text-slate-900 text-sm">{data.student?.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>Library ID: <strong className="text-slate-800">GL-STD-{data.student?.id?.toString().padStart(4, "0")}</strong></div>
                <div>Seat & Room: <strong className="text-slate-800">{roomName} ({data.student?.seat_id})</strong></div>
                <div>Payment Method: <strong className="text-slate-800">{paymentRecord.method} ({paymentRecord.payment_type.toUpperCase()})</strong></div>
                <div>Billing Month: <strong className="text-slate-800">{paymentRecord.billing_month}</strong></div>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Original Subscription Fee</span>
                  <span>₹{paymentRecord.original_fee}</span>
                </div>
                {paymentRecord.late_fee > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Late Payment Charge</span>
                    <span>+ ₹{paymentRecord.late_fee}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1">
                  <span>Amount Paid</span>
                  <span className="text-emerald-600">₹{paymentRecord.amount}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Remaining Balance</span>
                  <span className={paymentRecord.balance_remaining > 0 ? "text-rose-600 font-bold" : "text-slate-700"}>
                    ₹{paymentRecord.balance_remaining}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-indigo-700 font-semibold bg-indigo-50/60 p-2.5 rounded-xl">
                <span>Next Due Date</span>
                <span>{data.nextDueDate || data.student?.due_date}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Digital Receipt verified & archived in Genius Library records</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs"
              >
                Close
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex-1 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 text-xs"
              >
                <Download className="w-4 h-4" />
                Download PDF Receipt
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
