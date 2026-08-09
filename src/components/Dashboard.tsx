import { useState, useEffect } from "react";
import { Users, Grid, CheckCircle, AlertCircle, TrendingUp, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { API_BASE_URL } from "../constants";

interface Stats {
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  totalStudents: number;
  pendingPayments: number;
  monthlyCollection: number;
}

export default function Dashboard({ token, onLogout }: { token: string; onLogout?: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const defaultStats: Stats = {
    totalSeats: 75,
    occupiedSeats: 0,
    availableSeats: 75,
    totalStudents: 0,
    pendingPayments: 0,
    monthlyCollection: 0,
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onLogout?.();
        return;
      }
      const data = await res.json();
      if (data && !data.error) {
        setStats(data);
      } else {
        setStats(defaultStats);
      }
    } catch (err) {
      console.error(err);
      setStats(defaultStats);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  const cards = [
    { label: "Total Students", value: stats?.totalStudents, icon: Users, color: "bg-blue-500" },
    { label: "Occupied Seats", value: stats?.occupiedSeats, icon: Grid, color: "bg-indigo-500" },
    { label: "Available Seats", value: stats?.availableSeats, icon: CheckCircle, color: "bg-emerald-500" },
    { label: "Pending Payments", value: stats?.pendingPayments, icon: AlertCircle, color: "bg-rose-500" },
    { label: "Monthly Collection", value: `₹${stats?.monthlyCollection}`, icon: TrendingUp, color: "bg-amber-500" },
    { label: "Total Capacity", value: stats?.totalSeats, icon: Wallet, color: "bg-slate-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Library Overview</h1>
        <p className="text-slate-500">Real-time statistics of your library</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4"
          >
            <div className={`${card.color} p-3 rounded-xl shadow-lg shadow-opacity-20`}>
              <card.icon className="text-white w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <p className="text-slate-500 text-sm italic">Coming soon: Recent payments and student registrations...</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Payment Alerts</h2>
          {stats?.pendingPayments && stats.pendingPayments > 0 ? (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-3">
              <AlertCircle className="text-rose-600 w-5 h-5" />
              <p className="text-rose-700 font-medium">
                {stats.pendingPayments} students have pending payments!
              </p>
            </div>
          ) : (
            <p className="text-emerald-600 font-medium">All payments are up to date.</p>
          )}
        </div>
      </div>
    </div>
  );
}
