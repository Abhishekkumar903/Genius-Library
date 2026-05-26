import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SHIFT_OPTIONS, API_BASE_URL } from "../constants";

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  token: string;
  onSuccess: () => void;
}

export default function StudentModal({ isOpen, onClose, student, token, onSuccess }: StudentModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    father_name: "",
    mobile: "",
    seat_id: "",
    timing: SHIFT_OPTIONS[0].label,
    fees_amount: SHIFT_OPTIONS[0].fee.toString(),
    join_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        father_name: student.father_name,
        mobile: student.mobile,
        seat_id: student.seat_id,
        timing: student.timing,
        fees_amount: student.fees_amount.toString(),
        join_date: student.join_date,
        due_date: student.due_date,
      });
    } else {
      setFormData({
        name: "",
        father_name: "",
        mobile: "",
        seat_id: "",
        timing: SHIFT_OPTIONS[0].label,
        fees_amount: SHIFT_OPTIONS[0].fee.toString(),
        join_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
      });
    }
  }, [student, isOpen]);

  const handleTimingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLabel = e.target.value;
    const shift = SHIFT_OPTIONS.find(s => s.label === selectedLabel);
    if (shift) {
      setFormData({
        ...formData,
        timing: selectedLabel,
        fees_amount: shift.fee.toString()
      });
    } else {
      setFormData({ ...formData, timing: selectedLabel });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = student ? `${API_BASE_URL}/api/students/${student.id}` : `${API_BASE_URL}/api/students`;
      const method = student ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          fees_amount: parseFloat(formData.fees_amount),
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900">
              {student ? "Edit Student" : "Add New Student"}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Student's name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Father's Name</label>
                <input
                  type="text"
                  required
                  value={formData.father_name}
                  onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Father's name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="10-digit mobile"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Seat Number</label>
                <input
                  type="text"
                  required
                  value={formData.seat_id}
                  onChange={(e) => setFormData({ ...formData, seat_id: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. A1, B15"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Timing</label>
                <select
                  value={formData.timing}
                  onChange={handleTimingChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  {SHIFT_OPTIONS.map(option => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Fees Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.fees_amount}
                  onChange={(e) => setFormData({ ...formData, fees_amount: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Monthly fees"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Join Date</label>
                <input
                  type="date"
                  required
                  value={formData.join_date}
                  onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Next Due Date</label>
                <input
                  type="date"
                  required
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {loading ? "Saving..." : student ? "Update Student" : "Add Student"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
