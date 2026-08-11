import { jsPDF } from "jspdf";

export interface StudentProfile {
  id: number;
  name: string;
  father_name: string;
  mobile: string;
  seat_id: string;
  timing: string;
  fees_amount: number;
  join_date: string;
  due_date: string;
  status?: string;
  room?: string;
  billing_cycle?: string;
  membership_status?: string;
  balance_due?: number;
}

export interface PaymentRecord {
  id?: number;
  student_id: number;
  amount: number;
  original_fee: number;
  late_fee: number;
  total_due: number;
  balance_remaining: number;
  date: string;
  method: "Cash" | "UPI" | "Bank Transfer";
  payment_type: "full" | "partial" | "advance";
  payment_status: "Paid" | "Partially Paid" | "Overdue" | "Due Soon";
  billing_month: string;
  invoice_id: string;
  notes?: string;
  student?: StudentProfile;
}

/**
 * Calculates late fee according to requirements:
 * 0 days late -> ₹0
 * 1-7 days late -> ₹20
 * 8-15 days late -> ₹50
 * > 15 days late -> ₹100
 */
export function calculateLateFee(dueDateStr: string, asOfDateStr?: string): { daysLate: number; lateFee: number } {
  if (!dueDateStr) return { daysLate: 0, lateFee: 0 };

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
  asOf.setHours(0, 0, 0, 0);

  const diffTime = asOf.getTime() - due.getTime();
  const daysLate = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysLate <= 0) return { daysLate: 0, lateFee: 0 };
  if (daysLate <= 7) return { daysLate, lateFee: 20 };
  if (daysLate <= 15) return { daysLate, lateFee: 50 };
  return { daysLate, lateFee: 100 };
}

/**
 * Derives student room from seat_id or explicit field
 */
export function getStudentRoom(seatId: string, explicitRoom?: string): string {
  if (explicitRoom) return explicitRoom;
  if (!seatId) return "Room A";
  const firstChar = seatId.trim().toUpperCase().charAt(0);
  if (firstChar === "B") return "Room B";
  return "Room A";
}

/**
 * Calculates student payment status: Paid, Partially Paid, Overdue, Due Soon
 */
export function calculatePaymentStatus(dueDateStr: string, balanceDue: number = 0): "Paid" | "Partially Paid" | "Overdue" | "Due Soon" {
  const today = new Date().toISOString().slice(0, 10);
  
  if (balanceDue > 0 && balanceDue < 100) return "Partially Paid";
  
  if (dueDateStr < today) {
    return balanceDue > 0 ? "Partially Paid" : "Overdue";
  }

  // Calculate days until due date
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= 0 && diffDays <= 3) {
    return "Due Soon";
  }

  return balanceDue > 0 ? "Partially Paid" : "Paid";
}

/**
 * Generate PDF Receipt using jsPDF
 */
export function generatePDFReceipt(payment: PaymentRecord, student: StudentProfile) {
  const doc = new jsPDF();
  const roomName = getStudentRoom(student.seat_id, student.room);

  // Brand Header
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(0, 0, 210, 28, "F");

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("GENIUS LIBRARY", 105, 14, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text("Smart Library Management System • Official Payment Receipt", 105, 22, { align: "center" });

  // Receipt & Date Box
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`Receipt No: ${payment.invoice_id}`, 15, 38);
  doc.text(`Date & Time: ${payment.date}`, 195, 38, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.line(15, 43, 195, 43);

  // Student Details Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 48, 180, 48, 3, 3, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, 48, 180, 48, 3, 3, "S");

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Student & Membership Details", 20, 56);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Student Name: ${student.name}`, 20, 65);
  doc.text(`Father's Name: ${student.father_name || "N/A"}`, 20, 72);
  doc.text(`Mobile Number: ${student.mobile}`, 20, 79);
  doc.text(`Library ID: GL-STD-${student.id.toString().padStart(4, "0")}`, 20, 86);

  doc.text(`Room: ${roomName}`, 120, 65);
  doc.text(`Seat Number: ${student.seat_id}`, 120, 72);
  doc.text(`Timing Shift: ${student.timing || "General"}`, 120, 79);
  doc.text(`Billing Cycle: ${student.billing_cycle || "1st of every month"}`, 120, 86);

  // Payment Breakdown Table
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 102, 180, 10, "F");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("Item / Description", 20, 108);
  doc.text("Billing Month", 110, 108);
  doc.text("Amount (INR)", 190, 108, { align: "right" });

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text("Monthly Seat Subscription Fee", 20, 120);
  doc.text(payment.billing_month || "Current Month", 110, 120);
  doc.text(`INR ${(payment.original_fee || student.fees_amount).toFixed(2)}`, 190, 120, { align: "right" });

  if (payment.late_fee > 0) {
    doc.text("Late Payment Fee", 20, 128);
    doc.text("-", 110, 128);
    doc.text(`INR ${payment.late_fee.toFixed(2)}`, 190, 128, { align: "right" });
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(15, 134, 195, 134);

  // Calculations
  doc.setFontSize(10);
  doc.text("Total Amount Due:", 120, 142);
  doc.text(`INR ${(payment.total_due || payment.amount).toFixed(2)}`, 190, 142, { align: "right" });

  doc.text("Amount Paid:", 120, 150);
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`INR ${payment.amount.toFixed(2)}`, 190, 150, { align: "right" });

  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text("Remaining Balance:", 120, 158);
  doc.text(`INR ${(payment.balance_remaining || 0).toFixed(2)}`, 190, 158, { align: "right" });

  doc.text("Payment Method:", 20, 150);
  doc.text(`${payment.method || "UPI"} (${(payment.payment_type || "Full").toUpperCase()})`, 60, 150);

  if (payment.notes) {
    doc.text("Notes:", 20, 158);
    doc.text(payment.notes, 60, 158);
  }

  doc.line(15, 166, 195, 166);

  // Footer & Signature
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Next Due Date: " + (student.due_date || "N/A"), 15, 176);

  doc.text("Authorized Signatory", 195, 190, { align: "right" });
  doc.line(145, 185, 195, 185);
  doc.text("Genius Library Administration Desk", 195, 195, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Thank you for choosing Genius Library. Keep Learning & Growing!", 105, 210, { align: "center" });

  doc.save(`Receipt_${student.name.replace(/\s+/g, "_")}_${payment.invoice_id}.pdf`);
}

/**
 * Export array of records to CSV / Excel readable file
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(val => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
