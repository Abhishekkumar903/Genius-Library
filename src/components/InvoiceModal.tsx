import { X, Download, Printer } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
}

export default function InvoiceModal({ isOpen, onClose, data }: InvoiceModalProps) {
  if (!isOpen || !data) return null;

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text("GENIUS LIBRARY", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Premium Study Environment", 105, 26, { align: "center" });
    
    // Invoice Info
    doc.setDrawColor(200);
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Invoice ID: ${data.invoice_id}`, 20, 45);
    doc.text(`Date: ${data.date}`, 190, 45, { align: "right" });
    
    // Student Info
    doc.setFontSize(14);
    doc.text("Bill To:", 20, 60);
    doc.setFontSize(12);
    doc.text(`Name: ${data.student.name}`, 20, 68);
    doc.text(`Father's Name: ${data.student.father_name}`, 20, 76);
    doc.text(`Mobile: ${data.student.mobile}`, 20, 84);
    doc.text(`Seat: ${data.student.seat_id}`, 20, 92);
    
    // Table Header
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 105, 170, 10, "F");
    doc.setFontSize(11);
    doc.text("Description", 25, 112);
    doc.text("Amount", 185, 112, { align: "right" });
    
    // Table Row
    doc.text("Library Membership Fees (Monthly)", 25, 125);
    doc.text(`INR ${data.amount.toFixed(2)}`, 185, 125, { align: "right" });
    
    doc.line(20, 135, 190, 135);
    
    // Total
    doc.setFontSize(14);
    doc.text("Total Amount:", 130, 145);
    doc.text(`INR ${data.amount.toFixed(2)}`, 185, 145, { align: "right" });
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Next Due Date: ${data.nextDueDate}`, 20, 160);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Thank you for choosing Genius Library!", 105, 180, { align: "center" });
    
    doc.save(`Invoice_${data.invoice_id}.pdf`);
  };

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
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900">Payment Success</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="p-8">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center mb-8">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
                <Printer className="text-white w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-emerald-900">Payment Collected Successfully</h3>
              <p className="text-emerald-700">Invoice #{data.invoice_id} has been generated.</p>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Student Name</span>
                <span className="font-bold text-slate-900">{data.student.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-bold text-slate-900">₹{data.amount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Next Due Date</span>
                <span className="font-bold text-indigo-600">{data.nextDueDate}</span>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                Done
              </button>
              <button
                onClick={downloadPDF}
                className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Invoice
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
