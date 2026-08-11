export interface ReminderLog {
  id: string;
  studentId: number;
  studentName: string;
  mobile: string;
  dueDate: string;
  amount: number;
  channel: "sms" | "email" | "whatsapp" | "both" | "all";
  status: "sent" | "failed";
  timestamp: string;
  message: string;
}

export interface ReminderConfig {
  enabled: boolean;
  channel: "sms" | "email" | "whatsapp" | "both" | "all";
  autoDaysBefore: number; // e.g. 1 day before or on overdue
}

const STORAGE_KEY_CONFIG = "genius_library_reminder_config";
const STORAGE_KEY_LOGS = "genius_library_reminder_logs";

export const getReminderConfig = (): ReminderConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn("Failed to load reminder config from storage", e);
  }
  return {
    enabled: true,
    channel: "sms",
    autoDaysBefore: 1,
  };
};

export const saveReminderConfig = (config: ReminderConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.warn("Failed to save reminder config", e);
  }
};

export const getReminderLogs = (): ReminderLog[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOGS);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn("Failed to load reminder logs", e);
  }
  return [];
};

export const saveReminderLogs = (logs: ReminderLog[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs.slice(0, 50))); // keep last 50
  } catch (e) {
    console.warn("Failed to save reminder logs", e);
  }
};

/**
 * Mock Service to send payment reminder to a student via SMS / Email / WhatsApp
 */
export async function sendMockReminder(student: {
  id: number;
  name: string;
  mobile: string;
  seat_id: string;
  fees_amount: number;
  due_date: string;
}, channel: "sms" | "email" | "whatsapp" | "both" | "all" = "sms"): Promise<ReminderLog> {
  // Simulate network delay for real feel
  await new Promise((resolve) => setTimeout(resolve, 600));

  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isOverdue = new Date(student.due_date) < new Date();
  const statusText = isOverdue ? "OVERDUE" : "DUE SOON";

  const messageParts: string[] = [];

  if (channel === "sms" || channel === "both" || channel === "all") {
    messageParts.push(`[SMS to ${student.mobile}] Dear ${student.name} (${student.seat_id}), your Genius Library fee of ₹${student.fees_amount} is ${statusText} (Due Date: ${student.due_date}). Please clear it at the desk.`);
  }

  if (channel === "email" || channel === "both" || channel === "all") {
    const cleanEmail = `${student.name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`;
    messageParts.push(`[Email to ${cleanEmail}] Subject: Fee Reminder - Genius Library (${student.seat_id})\nDear ${student.name},\nThis is a friendly reminder regarding your monthly subscription fee of ₹${student.fees_amount} due on ${student.due_date}. Status: ${statusText}.`);
  }

  if (channel === "whatsapp" || channel === "all") {
    messageParts.push(`[WhatsApp to +91-${student.mobile}] 👋 Hi ${student.name}, hope you are studying well! 📚 Your monthly Genius Library fee (Seat: ${student.seat_id}, Room: ${student.seat_id.startsWith("B") ? "Room B" : "Room A"}) of ₹${student.fees_amount} is ${statusText} (Due: ${student.due_date}). Quick UPI payment link: upi://pay?pa=geniuslibrary@upi&am=${student.fees_amount}. Thank you!`);
  }

  const message = messageParts.join("\n\n");

  const newLog: ReminderLog = {
    id: `REM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    studentId: student.id,
    studentName: student.name,
    mobile: student.mobile,
    dueDate: student.due_date,
    amount: student.fees_amount,
    channel,
    status: "sent",
    timestamp,
    message,
  };

  const existingLogs = getReminderLogs();
  saveReminderLogs([newLog, ...existingLogs]);

  return newLog;
}

/**
 * Bulk send mock reminders to multiple overdue students
 */
export async function sendBulkMockReminders(students: Array<{
  id: number;
  name: string;
  mobile: string;
  seat_id: string;
  fees_amount: number;
  due_date: string;
}>, channel: "sms" | "email" | "whatsapp" | "both" | "all" = "sms"): Promise<ReminderLog[]> {
  const results: ReminderLog[] = [];
  for (const student of students) {
    const log = await sendMockReminder(student, channel);
    results.push(log);
  }
  return results;
}
