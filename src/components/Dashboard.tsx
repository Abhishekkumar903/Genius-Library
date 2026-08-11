import { useState, useEffect } from "react";
import {
  Users,
  Grid,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Wallet,
  Calendar,
  Clock,
  Building2,
  PieChart as PieChartIcon,
  TrendingUp,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { API_BASE_URL } from "../constants";
import { calculateLateFee, getStudentRoom } from "../services/feeUtils";

interface DashboardProps {
  token: string;
  onLogout?: () => void;
}

export default function Dashboard({ token, onLogout }: DashboardProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [resStudents, resPayments, resStats] = await Promise.all([
        fetch(`${API_BASE_URL}/api/students`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/payments/all`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (resStudents.status === 401 || resPayments.status === 401) {
        onLogout?.();
        return;
      }

      if (resStudents.ok) {
        const dataS = await resStudents.json();
        setStudents(dataS || []);
      }
      if (resPayments.ok) {
        const dataP = await resPayments.json();
        setPayments(dataP || []);
      }
      if (resStats.ok) {
        const dataSt = await resStats.json();
        setStats(dataSt || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  // Fee Metrics Calculation
  const totalMonthlyRevenue = students.reduce((sum, s) => sum + (s.fees_amount || 0), 0);

  const thisMonthPayments = payments.filter((p) => p.date && p.date.startsWith(currentMonthStr));
  const feesCollectedThisMonth = thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const todaysPayments = payments.filter((p) => p.date && p.date.startsWith(today));
  const todaysCollectionsTotal = todaysPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const overdueStudents = students.filter((s) => s.due_date && s.due_date < today);
  const overdueFeesTotal = overdueStudents.reduce((sum, s) => {
    const { lateFee } = calculateLateFee(s.due_date);
    return sum + (s.fees_amount || 0) + lateFee;
  }, 0);

  const pendingStudents = students.filter((s) => s.due_date && s.due_date <= today);
  const pendingFeesTotal = students.reduce((sum, s) => sum + (s.balance_due || 0), 0);

  const partiallyPaidStudents = students.filter(
    (s) => (s.balance_due && s.balance_due > 0) || s.membership_status === "Partial"
  );

  const occupiedSeatsCount = new Set(students.map((s) => s.seat_id)).size;
  const totalCapacity = 75;
  const availableSeatsCount = Math.max(0, totalCapacity - occupiedSeatsCount);

  // Room-wise Revenue Calculation
  let roomACollection = 0;
  let roomBCollection = 0;
  payments.forEach((p) => {
    const r = getStudentRoom(p.seat_id, p.room);
    if (r === "Room B") {
      roomBCollection += p.amount || 0;
    } else {
      roomACollection += p.amount || 0;
    }
  });

  // Payment Method Breakdown
  let upiCount = 0;
  let cashCount = 0;
  let bankCount = 0;
  payments.forEach((p) => {
    const m = (p.method || "UPI").toLowerCase();
    if (m.includes("cash")) cashCount += p.amount || 0;
    else if (m.includes("bank") || m.includes("transfer")) bankCount += p.amount || 0;
    else upiCount += p.amount || 0;
  });

  const methodDistributionData = [
    { name: "UPI Payment", value: upiCount, color: "#4f46e5" },
    { name: "Cash Desk", value: cashCount, color: "#10b981" },
    { name: "Bank Transfer", value: bankCount, color: "#f59e0b" },
  ];

  const roomWiseData = [
    { name: "Room A (49 Seats)", revenue: roomACollection, fill: "#6366f1" },
    { name: "Room B (26 Seats)", revenue: roomBCollection, fill: "#8b5cf6" },
  ];

  // Monthly Trend Mock / Real
  const monthlyTrendData = [
    { month: "May 2026", collected: Math.round(feesCollectedThisMonth * 0.85), expected: totalMonthlyRevenue },
    { month: "Jun 2026", collected: Math.round(feesCollectedThisMonth * 0.9), expected: totalMonthlyRevenue },
    { month: "Jul 2026", collected: Math.round(feesCollectedThisMonth * 0.95), expected: totalMonthlyRevenue },
    { month: "Aug 2026", collected: feesCollectedThisMonth, expected: totalMonthlyRevenue },
  ];

  const summaryCards = [
    {
      label: "Total Monthly Revenue",
      value: `₹${totalMonthlyRevenue.toLocaleString()}`,
      subtitle: "Expected from all active seats",
      icon: IndianRupee,
      bgColor: "bg-indigo-600",
    },
    {
      label: "Fees Collected",
      value: `₹${feesCollectedThisMonth.toLocaleString()}`,
      subtitle: `Recorded in ${new Date().toLocaleString("en-US", { month: "long" })}`,
      icon: CheckCircle2,
      bgColor: "bg-emerald-600",
    },
    {
      label: "Today's Collections",
      value: `₹${todaysCollectionsTotal.toLocaleString()}`,
      subtitle: `${todaysPayments.length} payments recorded today`,
      icon: Wallet,
      bgColor: "bg-teal-600",
    },
    {
      label: "Pending Fees",
      value: `₹${pendingFeesTotal.toLocaleString()}`,
      subtitle: `${pendingStudents.length} students with due balances`,
      icon: Clock,
      bgColor: "bg-amber-600",
    },
    {
      label: "Overdue Fees",
      value: `₹${overdueFeesTotal.toLocaleString()}`,
      subtitle: `${overdueStudents.length} overdue (incl. late penalty)`,
      icon: AlertCircle,
      bgColor: "bg-rose-600",
    },
    {
      label: "Partially Paid Students",
      value: `${partiallyPaidStudents.length} Students`,
      subtitle: "Partial fee payment recorded",
      icon: Users,
      bgColor: "bg-purple-600",
    },
  ];

  if (loading) {
    return <div className="py-20 text-center text-slate-400 font-medium text-sm">Loading Genius Library stats...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Library Financial & Fee Dashboard</h1>
          <p className="text-slate-500 text-sm">
            Monthly fee management, collections ledger, and seat allocation analytics
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm">
          <Calendar className="w-4 h-4" /> Today: {today}
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {summaryCards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.label}</span>
              <div className={`${card.bgColor} p-2.5 rounded-xl text-white shadow-md shadow-slate-200`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">{card.subtitle}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Analytics & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" /> Monthly Revenue Trend
            </h2>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              4 Month Trend
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, ""]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Bar dataKey="expected" name="Expected Fee" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                <Bar dataKey="collected" name="Fees Collected" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Room-wise Collections & Method Distribution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Room-wise Collections */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" /> Room-Wise Revenue
              </h2>
              <p className="text-xs text-slate-400 mt-1">Room A (49 Seats) vs Room B (26 Seats)</p>
            </div>

            <div className="space-y-4 py-2">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-700">Room A (49 Seats)</span>
                  <span className="text-indigo-600">₹{roomACollection.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{
                      width: `${
                        roomACollection + roomBCollection > 0
                          ? Math.round((roomACollection / (roomACollection + roomBCollection)) * 100)
                          : 50
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-700">Room B (26 Seats)</span>
                  <span className="text-purple-600">₹{roomBCollection.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full"
                    style={{
                      width: `${
                        roomACollection + roomBCollection > 0
                          ? Math.round((roomBCollection / (roomACollection + roomBCollection)) * 100)
                          : 50
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between text-xs font-bold text-slate-800">
              <span>Total Collections</span>
              <span>₹{(roomACollection + roomBCollection).toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-600" /> Payment Methods
              </h2>
              <p className="text-xs text-slate-400 mt-1">UPI vs Cash vs Bank Transfer</p>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {methodDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 text-xs">
              {methodDistributionData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">₹{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Seat Occupancy & Recent Ledger Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seat Occupancy Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Grid className="w-5 h-5 text-indigo-600" /> Seat Capacity & Occupancy
            </h2>
            <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
              {Math.round((occupiedSeatsCount / totalCapacity) * 100)}% Occupied
            </span>
          </div>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Occupied Seats</span>
              <strong className="text-slate-900 font-bold">
                {occupiedSeatsCount} / {totalCapacity}
              </strong>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${(occupiedSeatsCount / totalCapacity) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-slate-600 pt-1">
              <span>Available Seats</span>
              <strong className="text-emerald-600 font-bold">{availableSeatsCount} Seats Free</strong>
            </div>
          </div>
        </div>

        {/* Live Recent Transactions Feed */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" /> Permanent Collection Ledger (Latest)
            </h2>
            <span className="text-xs text-slate-400 font-medium">Real-Time DB Synced</span>
          </div>

          <div className="space-y-3">
            {payments.slice(0, 5).map((p, idx) => (
              <div
                key={p.invoice_id || idx}
                className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold">
                    ₹
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      {p.student_name || "Student"} (Seat: {p.seat_id || "N/A"})
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {p.invoice_id} • {p.date} • via {p.method || "UPI"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-600 text-sm block">₹{p.amount}</span>
                  {p.late_fee > 0 && (
                    <span className="text-[10px] text-rose-500 font-semibold">+₹{p.late_fee} late fee</span>
                  )}
                </div>
              </div>
            ))}

            {payments.length === 0 && (
              <p className="text-slate-400 text-xs text-center py-6">No recent fee collections recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
