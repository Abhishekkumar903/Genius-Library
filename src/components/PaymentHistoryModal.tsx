import { useState, useEffect, useMemo } from "react";
import { X, Calendar, Download, History, Search, Filter, FileSpreadsheet, FileText, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { API_BASE_URL } from "../constants";
import { generatePDFReceipt, getStudentRoom, exportToCSV, PaymentRecord } from "../services/feeUtils";
import { jsPDF } from "jspdf";

interface PaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  token: string;
}

export default function PaymentHistoryModal({ isOpen, onClose, student, token }: PaymentHistoryModalProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");

  // Search and Filters state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");

  useEffect(() => {
    if (student && isOpen) {
      fetchPaymentHistory();
    }
  }, [student, isOpen]);

  const fetchPaymentHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/history/${student.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Available unique months for filtering
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    payments.forEach((p) => {
      if (p.billing_month) months.add(p.billing_month);
    });
    return Array.from(months);
  }, [payments]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.invoice_id || "").toLowerCase().includes(q) ||
        (p.transaction_id || "").toLowerCase().includes(q) ||
        (p.billing_month || "").toLowerCase().includes(q) ||
        (p.notes || "").toLowerCase().includes(q) ||
        (p.method || "").toLowerCase().includes(q);

      const matchesMonth = selectedMonth === "ALL" || p.billing_month === selectedMonth;
      const matchesStatus =
        selectedStatus === "ALL" ||
        (p.payment_status || "Paid").toLowerCase() === selectedStatus.toLowerCase();
      const matchesMethod =
        selectedMethod === "ALL" ||
        (p.method || "UPI").toLowerCase() === selectedMethod.toLowerCase();

      return matchesSearch && matchesMonth && matchesStatus && matchesMethod;
    });
  }, [payments, searchQuery, selectedMonth, selectedStatus, selectedMethod]);

  if (!isOpen || !student) return null;

  const roomName = getStudentRoom(student.seat_id, student.room);

  // Export full payment history list to CSV
  const handleExportCSV = () => {
    const headers = [
      "Receipt Number",
      "Transaction ID",
      "Student ID",
      "Student Name",
      "Room & Seat",
      "Payment Date",
      "Billing Month",
      "Original Fee (INR)",
      "Late Fee (INR)",
      "Amount Paid (INR)",
      "Balance Remaining (INR)",
      "Method",
      "Payment Status",
      "Notes",
    ];

    const rows = filteredPayments.map((p) => [
      p.invoice_id || "N/A",
      p.transaction_id || p.invoice_id || "N/A",
      student.id,
      student.name,
      `${roomName} - ${student.seat_id}`,
      p.date,
      p.billing_month || "N/A",
      p.original_fee || student.fees_amount,
      p.late_fee || 0,
      p.amount,
      p.balance_remaining || 0,
      p.method || "UPI",
      p.payment_status || (p.balance_remaining > 0 ? "Partially Paid" : "Paid"),
      p.notes || "",
    ]);

    exportToCSV(`Payment_History_${student.name.replace(/\s+/g, "_")}`, headers, rows);
  };

  // Export payment history summary to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 24, "F");

    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("GENIUS LIBRARY - PAYMENT STATEMENT", 105, 14, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Student: ${student.name} (GL-STD-${student.id})`, 15, 34);
    doc.text(`Room: ${roomName} | Seat: ${student.seat_id}`, 15, 41);
    doc.text(`Mobile: ${student.mobile}`, 15, 48);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 195, 34, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 54, 195, 54);

    let y = 62;
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text("Date", 15, y);
    doc.text("Receipt #", 40, y);
    doc.text("Txn ID", 75, y);
    doc.text("Month", 115, y);
    doc.text("Method", 145, y);
    doc.text("Amount (INR)", 195, y, { align: "right" });

    y += 4;
    doc.line(15, y, 195, y);
    y += 6;

    filteredPayments.forEach((p) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(String(p.date || ""), 15, y);
      doc.text(String(p.invoice_id || ""), 40, y);
      doc.text(String(p.transaction_id || p.invoice_id || ""), 75, y);
      doc.text(String(p.billing_month || ""), 115, y);
      doc.text(String(p.method || "UPI"), 145, y);
      doc.text(`₹${(p.amount || 0).toFixed(2)}`, 195, y, { align: "right" });
      y += 8;
    });

    doc.save(`Statement_${student.name.replace(/\s+/g, "_")}.pdf`);
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
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between bg-slate-50/80 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Permanent Payment History & Ledger</h2>
                <p className="text-xs text-slate-500">
                  {student.name} • Seat {student.seat_id} ({roomName}) • ID: GL-STD-{student.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                title="Export to Excel CSV"
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-emerald-200"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel CSV
              </button>
              <button
                onClick={handleExportPDF}
                title="Export Statement PDF"
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-rose-200"
              >
                <FileText className="w-3.5 h-3.5" /> Statement PDF
              </button>
              <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setViewMode("timeline")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    viewMode === "timeline" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-600"
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    viewMode === "table" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-600"
                  }`}
                >
                  Table
                </button>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto space-y-5">
            {/* Student Summary Card */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Monthly Fee</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">₹{student.fees_amount}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Due Date</span>
                <p className="font-bold text-indigo-600 text-sm mt-0.5">{student.due_date}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Billing Cycle</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{student.billing_cycle || "1st of month"}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Status</span>
                <p className="font-bold text-emerald-600 text-sm mt-0.5">{student.membership_status || "Active"}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Total Entries</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{payments.length} Transactions</p>
              </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search receipt #, Txn ID, notes..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Filter Month */}
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none font-medium"
                  >
                    <option value="ALL">All Months</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Status */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                </select>

                {/* Filter Method */}
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none font-medium"
                >
                  <option value="ALL">All Payment Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash Desk</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading permanent payment ledger...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-slate-500 font-medium text-sm">No matching payment entries found.</p>
                <p className="text-xs text-slate-400">
                  {payments.length === 0
                    ? "Collect a payment to populate student's ledger."
                    : "Try adjusting search query or active filters."}
                </p>
              </div>
            ) : viewMode === "timeline" ? (
              /* Timeline View */
              <div className="relative pl-6 border-l-2 border-indigo-100 space-y-5">
                {filteredPayments.map((p, idx) => (
                  <div key={p.invoice_id || idx} className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>

                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-base">₹{p.amount} Paid</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">
                            {p.method || "UPI"}
                          </span>
                          <span
                            className={`px-2 py-0.5 font-bold text-[10px] rounded-full border ${
                              p.balance_remaining > 0
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}
                          >
                            {p.payment_status || (p.balance_remaining > 0 ? "Partially Paid" : "Paid")}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" /> {p.date}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                        <div>
                          Receipt #: <strong className="text-slate-900">{p.invoice_id}</strong>
                        </div>
                        <div>
                          Txn ID: <strong className="text-slate-900">{p.transaction_id || p.invoice_id}</strong>
                        </div>
                        <div>
                          Month: <strong className="text-slate-900">{p.billing_month || "Current"}</strong>
                        </div>
                        <div>
                          Balance After: <strong className="text-rose-600 font-bold">₹{p.balance_remaining || 0}</strong>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between pt-1 gap-2 border-t border-slate-100 text-xs text-slate-500">
                        <div>
                          Original Fee: ₹{p.original_fee || student.fees_amount} | Late Fee: ₹{p.late_fee || 0}
                        </div>
                        <button
                          onClick={() => generatePDFReceipt(p, student)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Receipt PDF
                        </button>
                      </div>

                      {p.notes && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          Note: {p.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Table View */
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Receipt #</th>
                      <th className="p-3">Transaction ID</th>
                      <th className="p-3">Month</th>
                      <th className="p-3">Amount Paid</th>
                      <th className="p-3">Late Fee</th>
                      <th className="p-3">Balance After</th>
                      <th className="p-3">Method</th>
                      <th className="p-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.map((p, idx) => (
                      <tr key={p.invoice_id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{p.date}</td>
                        <td className="p-3 font-bold text-slate-900">{p.invoice_id}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">{p.transaction_id || p.invoice_id}</td>
                        <td className="p-3 font-medium text-slate-800">{p.billing_month || "N/A"}</td>
                        <td className="p-3 font-bold text-emerald-600">₹{p.amount}</td>
                        <td className="p-3 text-rose-600 font-semibold">₹{p.late_fee || 0}</td>
                        <td className="p-3 font-bold text-slate-700">₹{p.balance_remaining || 0}</td>
                        <td className="p-3 text-slate-600">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">
                            {p.method || "UPI"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => generatePDFReceipt(p, student)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Download PDF Receipt"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
