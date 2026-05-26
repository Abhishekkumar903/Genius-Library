import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { User, Clock, AlertCircle, Grid } from "lucide-react";

interface Seat {
  id: string;
  status: "available" | "occupied-paid" | "occupied-pending";
  student_id: number | null;
  student_name?: string;
  student_mobile?: string;
  due_date?: string;
  timing?: string;
}

export default function SeatGrid({ token, onLogout }: { token: string; onLogout?: () => void }) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  useEffect(() => {
    fetchSeats();
  }, []);

  const fetchSeats = async () => {
    try {
      const res = await fetch("/api/seats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onLogout?.();
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setSeats(data);
      } else {
        setSeats([]);
      }
    } catch (err) {
      console.error(err);
      setSeats([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-slate-100 border-slate-200 text-slate-400";
      case "occupied-paid": return "bg-emerald-500 border-emerald-600 text-white";
      case "occupied-pending": return "bg-rose-500 border-rose-600 text-white";
      default: return "bg-slate-100";
    }
  };

  const rooms = [
    { id: "A", name: "Room A", count: 49 },
    { id: "B", name: "Room B", count: 26 },
  ];

  if (loading) return <div className="flex items-center justify-center h-64">Loading seats...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seat Management</h1>
          <p className="text-slate-500">Total Capacity: 75 Seats (Room A: 49, Room B: 26)</p>
        </div>
        
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500"></div>
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-rose-500"></div>
            <span>Pending</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          {rooms.map(room => (
            <div key={room.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-sm">
                  {room.id}
                </span>
                {room.name} ({room.count} Seats)
              </h2>
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-3">
                {seats.filter(s => s.id.startsWith(room.id)).map(seat => (
                  <button
                    key={seat.id}
                    onClick={() => setSelectedSeat(seat)}
                    className={`
                      aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95
                      ${getStatusColor(seat.status)}
                      ${selectedSeat?.id === seat.id ? "ring-4 ring-indigo-200 scale-110" : ""}
                    `}
                  >
                    <span className="text-xs font-bold">{seat.id}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-8">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Seat Details</h2>
            {selectedSeat ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${getStatusColor(selectedSeat.status)}`}>
                    {selectedSeat.id}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Status</p>
                    <p className={`font-bold capitalize ${selectedSeat.status === 'available' ? 'text-slate-600' : selectedSeat.status === 'occupied-paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {selectedSeat.status.replace('-', ' ')}
                    </p>
                  </div>
                </div>

                {selectedSeat.student_id ? (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase">Student</p>
                        <p className="font-semibold text-slate-900">{selectedSeat.student_name}</p>
                        <p className="text-sm text-slate-500">{selectedSeat.student_mobile}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase">Timing</p>
                        <p className="font-semibold text-slate-900 capitalize">{selectedSeat.timing}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 font-medium uppercase">Due Date</p>
                        <p className={`font-semibold ${selectedSeat.status === 'occupied-pending' ? 'text-rose-600' : 'text-slate-900'}`}>
                          {selectedSeat.due_date}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-slate-500 text-sm text-center py-8">
                      This seat is currently empty. Go to Students tab to assign a student.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Grid className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Select a seat to see details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
