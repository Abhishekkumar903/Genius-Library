import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Phone, Calendar, Clock, Bell, Send, Mail, MessageSquare, CheckCircle2, X, History, Sparkles, Filter, Layers, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import StudentModal from "./StudentModal";
import PaymentModal from "./PaymentModal";
import InvoiceModal from "./InvoiceModal";
import PaymentHistoryModal from "./PaymentHistoryModal";
import { API_BASE_URL } from "../constants";
import { getStudentRoom, calculatePaymentStatus } from "../services/feeUtils";
import { 
  getReminderConfig, 
  saveReminderConfig, 
  sendMockReminder, 
  sendBulkMockReminders, 
  getReminderLogs, 
  ReminderConfig, 
  ReminderLog 
} from "../services/reminderService";

interface Student {
  id: number;
  name: string;
  father_name: string;
  mobile: string;
  seat_id: string;
  timing: string;
  fees_amount: number;
  join_date: string;
  due_date: string;
  room?: string;
  billing_cycle?: string;
  membership_status?: string;
  balance_due?: number;
}

export default function StudentList({ token, onLogout }: { token: string; onLogout?: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partially" | "overdue" | "duesoon">("all");
  const [roomFilter, setRoomFilter] = useState<"all" | "Room A" | "Room B">("all");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  // Reminder state & controls
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(getReminderConfig());
  const [sendingStudentId, setSendingStudentId] = useState<number | null>(null);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>(getReminderLogs());
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: "success" | "info" } | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleConfigChange = (updated: Partial<ReminderConfig>) => {
    const newConfig = { ...reminderConfig, ...updated };
    setReminderConfig(newConfig);
    saveReminderConfig(newConfig);

    showToast(
      newConfig.enabled ? "Auto-Reminders Active" : "Auto-Reminders Paused",
      newConfig.enabled 
        ? `Automated payment reminders enabled via ${newConfig.channel.toUpperCase()}`
        : "Automated background payment reminders have been disabled.",
      "info"
    );
  };

  const showToast = (title: string, desc: string, type: "success" | "info" = "success") => {
    setToastMessage({ title, desc, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onLogout?.();
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setStudents(data);
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.error(err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this student profile?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/students/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchStudents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSingleReminder = async (student: Student) => {
    setSendingStudentId(student.id);
    try {
      const log = await sendMockReminder(student, reminderConfig.channel);
      setReminderLogs(getReminderLogs());
      showToast(
        `Reminder Sent to ${student.name}`,
        `Mock ${reminderConfig.channel.toUpperCase()} dispatch to ${student.mobile} (Seat: ${student.seat_id})`,
        "success"
      );
    } catch (err) {
      console.error("Failed to send reminder", err);
    } finally {
      setSendingStudentId(null);
    }
  };

  const handleBulkReminders = async () => {
    const overdueList = students.filter(s => isPending(s.due_date));
    if (overdueList.length === 0) {
      showToast("No Overdue Payments", "All students are up to date with their fees!", "info");
      return;
    }

    setIsBulkSending(true);
    try {
      const logs = await sendBulkMockReminders(overdueList, reminderConfig.channel);
      setReminderLogs(getReminderLogs());
      showToast(
        "Automated Reminders Dispatched",
        `Sent ${reminderConfig.channel.toUpperCase()} reminders to ${logs.length} overdue student(s).`,
        "success"
      );
    } catch (err) {
      console.error("Failed bulk reminders", err);
    } finally {
      setIsBulkSending(false);
    }
  };

  const isPending = (dueDate: string) => {
    if (!dueDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return dueDate < today;
  };

  // Status Counts
  const overdueCount = students.filter(s => isPending(s.due_date)).length;
  const paidCount = students.filter(s => !isPending(s.due_date) && (!s.balance_due || s.balance_due === 0)).length;
  const partialCount = students.filter(s => s.balance_due && s.balance_due > 0).length;

  const filteredStudents = students.filter(s => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || 
      s.name.toLowerCase().includes(query) || 
      s.seat_id.toLowerCase().includes(query) ||
      s.mobile.includes(query) ||
      (s.father_name && s.father_name.toLowerCase().includes(query));
    
    const computedRoom = getStudentRoom(s.seat_id, s.room);
    const matchesRoom = roomFilter === "all" || computedRoom === roomFilter;

    const calcStatus = calculatePaymentStatus(s.due_date, s.balance_due || 0);

    if (!matchesSearch || !matchesRoom) return false;

    if (statusFilter === "overdue") return calcStatus === "Overdue";
    if (statusFilter === "paid") return calcStatus === "Paid";
    if (statusFilter === "partially") return calcStatus === "Partially Paid";
    if (statusFilter === "duesoon") return calcStatus === "Due Soon";

    return true;
  });

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 max-w-sm bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 flex items-start gap-3"
          >
            <div className={`p-2 rounded-xl mt-0.5 ${toastMessage.type === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400"}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 pr-2">
              <p className="font-bold text-sm text-slate-100">{toastMessage.title}</p>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toastMessage.desc}</p>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student & Fee Directory</h1>
          <p className="text-slate-500 text-sm">Manage student profiles, monthly fee structures, room allocations & reminders</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLogsOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm text-sm"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Reminder Logs</span>
            {reminderLogs.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 font-bold rounded-full">
                {reminderLogs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setSelectedStudent(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm"
          >
            <Plus className="w-5 h-5" />
            Add Student
          </button>
        </div>
      </div>

      {/* Automated Payment Reminders Control Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                <Bell className="w-4 h-4" />
              </span>
              <h2 className="font-bold text-base text-white flex items-center gap-2">
                Automated Payment Reminders
                <span className="text-xs font-normal text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> SMS / Email / WhatsApp Service
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 pl-8">
              Dispatch instant fee alerts for overdue or due-soon library subscriptions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t lg:border-t-0 border-slate-800 pt-4 lg:pt-0">
            {/* Toggle Switch */}
            <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60">
              <span className="text-xs font-semibold text-slate-300">Reminders</span>
              <button
                type="button"
                onClick={() => handleConfigChange({ enabled: !reminderConfig.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  reminderConfig.enabled ? "bg-emerald-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    reminderConfig.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-xs font-bold ${reminderConfig.enabled ? "text-emerald-400" : "text-slate-400"}`}>
                {reminderConfig.enabled ? "ACTIVE" : "PAUSED"}
              </span>
            </div>

            {/* Channel Selection Toggle */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleConfigChange({ channel: "sms" })}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  reminderConfig.channel === "sms" ? "bg-indigo-600 text-white font-bold shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <MessageSquare className="w-3 h-3" /> SMS
              </button>
              <button
                type="button"
                onClick={() => handleConfigChange({ channel: "email" })}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  reminderConfig.channel === "email" ? "bg-indigo-600 text-white font-bold shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <Mail className="w-3 h-3" /> Email
              </button>
              <button
                type="button"
                onClick={() => handleConfigChange({ channel: "whatsapp" })}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  reminderConfig.channel === "whatsapp" ? "bg-indigo-600 text-white font-bold shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => handleConfigChange({ channel: "all" })}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  reminderConfig.channel === "all" ? "bg-indigo-600 text-white font-bold shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                All
              </button>
            </div>

            <button
              type="button"
              onClick={handleBulkReminders}
              disabled={isBulkSending || overdueCount === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
                overdueCount > 0
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Send className={`w-3.5 h-3.5 ${isBulkSending ? "animate-spin" : ""}`} />
              {isBulkSending ? "Sending..." : `Send All (${overdueCount} Overdue)`}
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar & Student Directory */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by student name, seat, mobile, father's name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-xs font-medium shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Room Filter */}
            <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-xs font-semibold">
              <span className="text-slate-500 px-2 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" /> Room:
              </span>
              <button
                onClick={() => setRoomFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all ${roomFilter === "all" ? "bg-white text-slate-900 font-bold shadow-sm" : "text-slate-600"}`}
              >
                All
              </button>
              <button
                onClick={() => setRoomFilter("Room A")}
                className={`px-2.5 py-1 rounded-lg transition-all ${roomFilter === "Room A" ? "bg-indigo-600 text-white font-bold shadow-sm" : "text-slate-600"}`}
              >
                Room A
              </button>
              <button
                onClick={() => setRoomFilter("Room B")}
                className={`px-2.5 py-1 rounded-lg transition-all ${roomFilter === "Room B" ? "bg-indigo-600 text-white font-bold shadow-sm" : "text-slate-600"}`}
              >
                Room B
              </button>
            </div>

            {/* Fee Status Filter */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === "all" ? "bg-white text-slate-900 font-bold shadow-sm" : "text-slate-600"}`}
              >
                All ({students.length})
              </button>

              <button
                onClick={() => setStatusFilter("paid")}
                className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === "paid" ? "bg-emerald-600 text-white font-bold shadow-sm" : "text-slate-600 hover:text-emerald-600"}`}
              >
                Paid ({paidCount})
              </button>

              <button
                onClick={() => setStatusFilter("partially")}
                className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === "partially" ? "bg-amber-600 text-white font-bold shadow-sm" : "text-slate-600 hover:text-amber-600"}`}
              >
                Partial ({partialCount})
              </button>

              <button
                onClick={() => setStatusFilter("overdue")}
                className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === "overdue" ? "bg-rose-600 text-white font-bold shadow-sm" : "text-slate-600 hover:text-rose-600"}`}
              >
                Overdue ({overdueCount})
              </button>
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4">Student & Profile</th>
                <th className="px-6 py-4">Seat & Room</th>
                <th className="px-6 py-4">Monthly Fee & Due Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.map((student) => {
                const roomName = getStudentRoom(student.seat_id, student.room);
                const status = calculatePaymentStatus(student.due_date, student.balance_due || 0);
                const isSending = sendingStudentId === student.id;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Student Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                          {student.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-500">Father: {student.father_name || "N/A"}</p>
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {student.mobile}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Room & Seat */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded border border-indigo-100">
                            {roomName}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded border border-slate-200">
                            Seat {student.seat_id}
                          </span>
                        </div>
                        <span className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" /> {student.timing}
                        </span>
                      </div>
                    </td>

                    {/* Monthly Fee & Due Date */}
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-slate-900 text-sm">₹{student.fees_amount}</p>
                        <p className="text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" /> Due: <strong className="text-slate-800">{student.due_date}</strong>
                        </p>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                        status === "Paid" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : status === "Partially Paid"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : status === "Due Soon"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          status === "Paid" ? "bg-emerald-500" : status === "Partially Paid" ? "bg-amber-500" : status === "Due Soon" ? "bg-indigo-500" : "bg-rose-500"
                        }`}></span>
                        {status.toUpperCase()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Collect Payment */}
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setIsPaymentModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                          title="Collect Monthly Fee"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Pay Fee</span>
                        </button>

                        {/* View History */}
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setIsHistoryModalOpen(true);
                          }}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                          title="Payment History & Receipts"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {/* Send Reminder */}
                        <button
                          onClick={() => handleSingleReminder(student)}
                          disabled={isSending}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                          title={`Send ${reminderConfig.channel.toUpperCase()} Reminder`}
                        >
                          <Bell className={`w-4 h-4 ${isSending ? "animate-bounce" : ""}`} />
                        </button>

                        {/* Edit Student */}
                        <button
                          onClick={() => {
                            setSelectedStudent(student);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                          title="Edit Student Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Student */}
                        <button
                          onClick={() => handleDelete(student.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No student records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminder Delivery Logs Modal */}
      <AnimatePresence>
        {isLogsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-6 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Reminder Delivery Logs</h3>
                    <p className="text-xs text-slate-500">History of dispatched SMS, Email & WhatsApp reminders</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLogsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {reminderLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.studentName}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 font-mono">{log.mobile}</span>
                      </div>
                      <span className="text-slate-400">{log.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded uppercase">
                        {log.channel}
                      </span>
                      <span className="text-slate-600 font-semibold">₹{log.amount}</span>
                      <span className="text-slate-400 font-normal">(Due: {log.dueDate})</span>
                    </div>

                    <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 font-mono leading-relaxed whitespace-pre-wrap">
                      {log.message}
                    </p>
                  </div>
                ))}

                {reminderLogs.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium">No reminder logs found.</p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsLogsOpen(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white font-semibold text-sm rounded-xl hover:bg-slate-800 transition-all"
                >
                  Close Logs
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StudentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        student={selectedStudent} 
        token={token}
        onSuccess={fetchStudents}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        student={selectedStudent}
        token={token}
        onSuccess={(data) => {
          setInvoiceData(data);
          setIsInvoiceModalOpen(true);
          fetchStudents();
        }}
      />

      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        data={invoiceData}
      />

      <PaymentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        student={selectedStudent}
        token={token}
      />
    </div>
  );
}
