export const SHIFT_OPTIONS = [
  { id: "4h-morning", label: "06:00AM - 10:00AM (4h)", fee: 200 },
  { id: "4h-midday", label: "10:00AM - 02:00PM (4h)", fee: 300 },
  { id: "4h-afternoon", label: "02:00PM - 06:00PM (4h)", fee: 300 },
  { id: "4h-evening", label: "06:00PM - 10:00PM (4h)", fee: 200 },
  { id: "8h-morning", label: "06:00AM - 02:00PM (8h)", fee: 450 },
  { id: "8h-midday", label: "10:00AM - 06:00PM (8h)", fee: 500 },
  { id: "8h-afternoon", label: "02:00PM - 10:00PM (8h)", fee: 500 },
  { id: "12h-morning", label: "06:00AM - 06:00PM (12h)", fee: 600 },
  { id: "12h-midday", label: "10:00AM - 10:00PM (12h)", fee: 600 },
  { id: "16h-full", label: "06:00AM - 10:00PM (16h)", fee: 700 },
];

export const API_BASE_URL = typeof window !== "undefined" && (
  window.location.hostname === "localhost" || 
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.includes(".run.app") || 
  window.location.hostname.includes("aistudio.google")
)
  ? "" 
  : "https://genius-library-production.up.railway.app";
