import { useState, useEffect } from "react";
import { Layout, Dashboard, SeatGrid, StudentList, ReportsView, Login } from "./components";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [view, setView] = useState<"dashboard" | "seats" | "students" | "reports">("dashboard");

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <Layout currentView={view} setView={setView} onLogout={() => setToken(null)}>
      {view === "dashboard" && <Dashboard token={token} onLogout={() => setToken(null)} />}
      {view === "seats" && <SeatGrid token={token} onLogout={() => setToken(null)} />}
      {view === "students" && <StudentList token={token} onLogout={() => setToken(null)} />}
      {view === "reports" && <ReportsView token={token} />}
    </Layout>
  );
}
