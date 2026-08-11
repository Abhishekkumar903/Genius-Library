import { useState, useEffect } from "react";
import { Download, FileText, Calendar, IndianRupee, Layers, CheckCircle2, Clock, Filter, Printer } from "lucide-react";
import { motion } from "motion/react";
import { API_BASE_URL } from "../constants";
import { calculateLateFee, exportToCSV, getStudentRoom } from "../services/feeUtils";
import jsPDF from "jspdf";

export default function ReportsView({ token }: { token: string }) {
  const [reportType, setReportType] = useState<"collection" | "outstanding" | "room" | "student">("collection");
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [resStudents, resPayments] = await Promise.all([
        fetch(`${API_BASE_URL}/api/students`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/payments/all`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (resStudents.ok) {
        const dataS = await resStudents.json();
        setStudents(dataS || []);
      }
      if (resPayments.ok) {
        const dataP = await resPayments.json();
        setPayments(dataP || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const today = new Date().toISOString().slice(0, 10);
  
  const totalMonthlyExpected = students.reduce((sum, s) => sum + (s.fees_amount || 0), 0);

  const thisMonthPayments = payments.filter(p => p.date && p.date.startsWith(selectedMonth));
  const feesCollectedThisMonth = thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const overdueStudents = students.filter(s => s.due_date && s.due_date < today);
  const overdueFeesTotal = overdueStudents.reduce((sum, s) => {
    const { lateFee } = calculateLateFee(s.due_date);
    return sum + (s.fees_amount || 0) + lateFee;
  }, 0);

  const pendingStudents = students.filter(s => s.due_date && s.due_date <= today);
  const pendingFeesTotal = pendingStudents.reduce((sum, s) => sum + (s.fees_amount || 0), 0);

  // Room Wise Revenue
  const roomAStudents = students.filter(s => getStudentRoom(s.seat_id, s.room) === "Room A");
  const roomBStudents = students.filter(s => getStudentRoom(s.seat_id, s.room) === "Room B");

  const roomARevenue = roomAStudents.reduce((sum, s) => sum + (s.fees_amount || 0), 0);
  const roomBRevenue = roomBStudents.reduce((sum, s) => sum + (s.fees_amount || 0), 0);

  // Filtered lists according to room selection
  const filterByRoom = (list: any[]) => {
    if (selectedRoom === "all") return list;
    return list.filter(item => getStudentRoom(item.seat_id || item.student_seat, item.room) === selectedRoom);
  };

  const handleExportCSV = () => {
    if (reportType === "collection") {
      const filtered = filterByRoom(thisMonthPayments);
      const headers = ["Receipt No", "Date", "Student Name", "Seat", "Room", "Billing Month", "Method", "Amount Paid (INR)", "Late Fee"];
      const rows = filtered.map(p => [
        p.invoice_id || "",
        p.date || "",
        p.student_name || p.student?.name || "Student",
        p.seat_id || p.student?.seat_id || "",
        getStudentRoom(p.seat_id || p.student?.seat_id, p.room),
        p.billing_month || "",
        p.method || "UPI",
        p.amount || 0,
        p.late_fee || 0,
      ]);
      exportToCSV(`Monthly_Collection_Report_${selectedMonth}`, headers, rows);
    } else if (reportType === "outstanding") {
      const filtered = filterByRoom(overdueStudents);
      const headers = ["Student ID", "Name", "Mobile", "Seat", "Room", "Due Date", "Original Fee", "Late Fee", "Total Outstanding"];
      const rows = filtered.map(s => {
        const { lateFee } = calculateLateFee(s.due_date);
        return [
          `GL-STD-${s.id}`,
          s.name,
          s.mobile,
          s.seat_id,
          getStudentRoom(s.seat_id, s.room),
          s.due_date,
          s.fees_amount,
          lateFee,
          s.fees_amount + lateFee,
        ];
      });
      exportToCSV(`Outstanding_Dues_Report_${today}`, headers, rows);
    } else if (reportType === "room") {
      const headers = ["Room Name", "Total Seats", "Active Students", "Expected Revenue (INR)", "Collected Revenue (INR)", "Pending Dues (INR)"];
      const rows = [
        ["Room A (A1-A49)", 49, roomAStudents.length, roomARevenue, "Calculated in Ledger", "Calculated in Ledger"],
        ["Room B (B1-B26)", 26, roomBStudents.length, roomBRevenue, "Calculated in Ledger", "Calculated in Ledger"],
      ];
      exportToCSV(`Room_Wise_Revenue_Report_${today}`, headers, rows);
    } else {
      const filtered = filterByRoom(students);
      const headers = ["Library ID", "Student Name", "Father Name", "Mobile", "Room & Seat", "Timing", "Monthly Fee", "Due Date", "Status"];
      const rows = filtered.map(s => {
        const isOver = s.due_date < today;
        return [
          `GL-STD-${s.id}`,
          s.name,
          s.father_name || "",
          s.mobile,
          `${getStudentRoom(s.seat_id, s.room)} (${s.seat_id})`,
          s.timing,
          s.fees_amount,
          s.due_date,
          isOver ? "OVERDUE" : "PAID",
        ];
      });
      exportToCSV(`Student_Payment_Report_${today}`, headers, rows);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229);
    doc.text("GENIUS LIBRARY", 105, 18, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Official Fee Management Report • ${reportType.toUpperCase()} REPORT`, 105, 24, { align: "center" });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 30, { align: "center" });

    doc.setDrawColor(200);
    doc.line(15, 35, 195, 35);

    let y = 45;
    doc.setFontSize(11);
    doc.setTextColor(30);

    if (reportType === "collection") {
      const filtered = filterByRoom(thisMonthPayments);
      doc.text(`Monthly Collections for ${selectedMonth} (Total: INR ${feesCollectedThisMonth})`, 15, y);
      y += 10;
      filtered.slice(0, 20).forEach((p, idx) => {
        doc.setFontSize(9);
        doc.text(`${idx + 1}. ${p.date} | ${p.student_name || "Student"} (${p.seat_id || "N/A"}) - Paid: INR ${p.amount} via ${p.method || "UPI"}`, 15, y);
        y += 7;
      });
    } else if (reportType === "outstanding") {
      const filtered = filterByRoom(overdueStudents);
      doc.text(`Outstanding Dues Report (Total Overdue Students: ${filtered.length})`, 15, y);
      y += 10;
      filtered.slice(0, 20).forEach((s, idx) => {
        const { lateFee } = calculateLateFee(s.due_date);
        doc.setFontSize(9);
        doc.text(`${idx + 1}. ${s.name} (${s.seat_id}) | Due: ${s.due_date} | Fee: INR ${s.fees_amount} + Late: INR ${lateFee} = Total: INR ${s.fees_amount + lateFee}`, 15, y);
        y += 7;
      });
    } else if (reportType === "room") {
      doc.text("Room-Wise Revenue Breakdown", 15, y);
      y += 10;
      doc.setFontSize(10);
      doc.text(`Room A (Seats A1-A49): ${roomAStudents.length} Students | Expected Monthly Revenue: INR ${roomARevenue}`, 15, y);
      y += 10;
      doc.text(`Room B (Seats B1-B26): ${roomBStudents.length} Students | Expected Monthly Revenue: INR ${roomBRevenue}`, 15, y);
    } else {
      const filtered = filterByRoom(students);
      doc.text(`Student Payment Ledger Summary (${filtered.length} Active Students)`, 15, y);
      y += 10;
      filtered.slice(0, 25).forEach((s, idx) => {
        doc.setFontSize(9);
        doc.text(`${idx + 1}. ${s.name} | Seat: ${s.seat_id} | Monthly Fee: INR ${s.fees_amount} | Next Due: ${s.due_date}`, 15, y);
        y += 7;
      });
    }

    doc.save(`Genius_Library_${reportType}_report.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fee Reports & Analytics</h1>
          <p className="text-slate-500 text-sm">Comprehensive collections, dues, and room revenue reports</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs shadow-sm">
            <Filter className="w-4 h-4 text-indigo-600" />
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none"
            >
              <option value="all">All Rooms</option>
              <option value="Room A">Room A (A1-A49)</option>
              <option value="Room B">Room B (B1-B26)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs shadow-sm">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV / Excel
          </button>

          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print PDF Report
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-500 rounded-xl text-white shadow-md shadow-indigo-100">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Monthly Revenue</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">₹{totalMonthlyExpected}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-500 rounded-xl text-white shadow-md shadow-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Fees Collected ({selectedMonth})</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">₹{feesCollectedThisMonth}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-rose-500 rounded-xl text-white shadow-md shadow-rose-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Overdue Fees + Late Charge</p>
            <p className="text-2xl font-bold text-rose-600 mt-0.5">₹{overdueFeesTotal}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-amber-500 rounded-xl text-white shadow-md shadow-amber-100">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Students with Due Fees</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{overdueStudents.length}</p>
          </div>
        </motion.div>
      </div>

      {/* Report Selection Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setReportType("collection")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${reportType === "collection" ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
          >
            <FileText className="w-4 h-4" /> Monthly Collection Report
          </button>

          <button
            onClick={() => setReportType("outstanding")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${reportType === "outstanding" ? "bg-rose-600 text-white shadow-md shadow-rose-100" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
          >
            <Clock className="w-4 h-4" /> Outstanding Dues Report
          </button>

          <button
            onClick={() => setReportType("room")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${reportType === "room" ? "bg-amber-600 text-white shadow-md shadow-amber-100" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
          >
            <Layers className="w-4 h-4" /> Room-Wise Revenue Report
          </button>

          <button
            onClick={() => setReportType("student")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${reportType === "student" ? "bg-emerald-600 text-white shadow-md shadow-emerald-100" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
          >
            <CheckCircle2 className="w-4 h-4" /> Student Payment Ledger
          </button>
        </div>

        {/* Report Content Table */}
        <div className="p-6 overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Generating report data...</div>
          ) : reportType === "collection" ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="p-3">Receipt #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Room & Seat</th>
                  <th className="p-3">Billing Month</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filterByRoom(thisMonthPayments).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">No collection records found for {selectedMonth}.</td>
                  </tr>
                ) : (
                  filterByRoom(thisMonthPayments).map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{p.invoice_id}</td>
                      <td className="p-3 text-slate-600">{p.date}</td>
                      <td className="p-3 font-bold text-slate-800">{p.student_name || p.student?.name || "Student"}</td>
                      <td className="p-3 text-slate-600">{getStudentRoom(p.seat_id || p.student?.seat_id, p.room)} ({p.seat_id || p.student?.seat_id})</td>
                      <td className="p-3 text-slate-600">{p.billing_month || selectedMonth}</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded">{p.method || "UPI"}</span></td>
                      <td className="p-3 text-right font-bold text-emerald-600">₹{p.amount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : reportType === "outstanding" ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="p-3">Student ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">Room & Seat</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Fee</th>
                  <th className="p-3">Late Fee</th>
                  <th className="p-3 text-right">Total Dues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filterByRoom(overdueStudents).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-emerald-600 font-bold">Great news! No outstanding dues.</td>
                  </tr>
                ) : (
                  filterByRoom(overdueStudents).map((s, i) => {
                    const { lateFee } = calculateLateFee(s.due_date);
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-500">GL-STD-{s.id}</td>
                        <td className="p-3 font-bold text-slate-900">{s.name}</td>
                        <td className="p-3 text-slate-600">{s.mobile}</td>
                        <td className="p-3 text-slate-600">{getStudentRoom(s.seat_id, s.room)} ({s.seat_id})</td>
                        <td className="p-3 text-rose-600 font-bold">{s.due_date}</td>
                        <td className="p-3 text-slate-700">₹{s.fees_amount}</td>
                        <td className="p-3 text-rose-600 font-bold">+ ₹{lateFee}</td>
                        <td className="p-3 text-right font-bold text-rose-600">₹{s.fees_amount + lateFee}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : reportType === "room" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-base">Room A Overview</h3>
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg">Seats A1 - A49</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600"><span>Occupied Seats:</span><strong className="text-slate-900">{roomAStudents.length} / 49</strong></div>
                  <div className="flex justify-between text-slate-600"><span>Monthly Expected Revenue:</span><strong className="text-indigo-600 font-bold">₹{roomARevenue}</strong></div>
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-base">Room B Overview</h3>
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-xs rounded-lg">Seats B1 - B26</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600"><span>Occupied Seats:</span><strong className="text-slate-900">{roomBStudents.length} / 26</strong></div>
                  <div className="flex justify-between text-slate-600"><span>Monthly Expected Revenue:</span><strong className="text-amber-600 font-bold">₹{roomBRevenue}</strong></div>
                </div>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="p-3">Library ID</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Father Name</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">Seat & Room</th>
                  <th className="p-3">Shift</th>
                  <th className="p-3">Monthly Fee</th>
                  <th className="p-3">Next Due</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filterByRoom(students).map((s, i) => {
                  const isOver = s.due_date < today;
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500">GL-STD-{s.id}</td>
                      <td className="p-3 font-bold text-slate-900">{s.name}</td>
                      <td className="p-3 text-slate-600">{s.father_name || "N/A"}</td>
                      <td className="p-3 text-slate-600">{s.mobile}</td>
                      <td className="p-3 font-semibold text-slate-800">{getStudentRoom(s.seat_id, s.room)} ({s.seat_id})</td>
                      <td className="p-3 text-slate-600">{s.timing}</td>
                      <td className="p-3 font-bold text-slate-900">₹{s.fees_amount}</td>
                      <td className="p-3 text-slate-600">{s.due_date}</td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 font-bold rounded-full text-[10px] ${isOver ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {isOver ? "OVERDUE" : "PAID"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
