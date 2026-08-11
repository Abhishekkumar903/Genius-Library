import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Helper to safely get or create SQLite database across Cloud Run and Netlify Lambda
export function getDatabase() {
  let dbPath = path.join(process.cwd(), "library.db");

  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = path.join("/tmp", "library.db");
    if (!fs.existsSync(tmpPath) && fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, tmpPath);
      } catch (e) {
        console.warn("Could not copy initial db to /tmp:", e);
      }
    }
    dbPath = tmpPath;
  }

  let db: Database.Database;
  try {
    db = new Database(dbPath);
  } catch (err) {
    console.warn("Falling back to in-memory SQLite database:", err);
    db = new Database(":memory:");
  }

  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );

    CREATE TABLE IF NOT EXISTS seats (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'available',
      student_id INTEGER,
      timing TEXT,
      FOREIGN KEY(student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      father_name TEXT,
      mobile TEXT,
      seat_id TEXT,
      timing TEXT,
      fees_amount REAL,
      join_date TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'active',
      room TEXT,
      billing_cycle TEXT DEFAULT '1st of every month',
      membership_status TEXT DEFAULT 'Active',
      balance_due REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      student_name TEXT,
      billing_month TEXT,
      amount REAL,
      original_fee REAL DEFAULT 0,
      late_fee REAL DEFAULT 0,
      total_due REAL DEFAULT 0,
      balance_remaining REAL DEFAULT 0,
      method TEXT DEFAULT 'UPI',
      payment_type TEXT DEFAULT 'full',
      transaction_id TEXT,
      invoice_id TEXT,
      date TEXT,
      payment_status TEXT DEFAULT 'Paid',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      student_name TEXT,
      mobile TEXT,
      channel TEXT,
      message TEXT,
      status TEXT DEFAULT 'sent',
      timestamp TEXT
    );
  `);

  // Safely add missing columns if upgrading database
  try {
    const studentColumns = db.prepare("PRAGMA table_info(students)").all() as any[];
    const colNames = studentColumns.map((c) => c.name);
    if (!colNames.includes("room")) db.exec("ALTER TABLE students ADD COLUMN room TEXT");
    if (!colNames.includes("billing_cycle")) db.exec("ALTER TABLE students ADD COLUMN billing_cycle TEXT DEFAULT '1st of every month'");
    if (!colNames.includes("membership_status")) db.exec("ALTER TABLE students ADD COLUMN membership_status TEXT DEFAULT 'Active'");
    if (!colNames.includes("balance_due")) db.exec("ALTER TABLE students ADD COLUMN balance_due REAL DEFAULT 0");

    const paymentColumns = db.prepare("PRAGMA table_info(payments)").all() as any[];
    const pColNames = paymentColumns.map((c) => c.name);
    if (!pColNames.includes("student_name")) db.exec("ALTER TABLE payments ADD COLUMN student_name TEXT");
    if (!pColNames.includes("billing_month")) db.exec("ALTER TABLE payments ADD COLUMN billing_month TEXT");
    if (!pColNames.includes("original_fee")) db.exec("ALTER TABLE payments ADD COLUMN original_fee REAL DEFAULT 0");
    if (!pColNames.includes("late_fee")) db.exec("ALTER TABLE payments ADD COLUMN late_fee REAL DEFAULT 0");
    if (!pColNames.includes("total_due")) db.exec("ALTER TABLE payments ADD COLUMN total_due REAL DEFAULT 0");
    if (!pColNames.includes("balance_remaining")) db.exec("ALTER TABLE payments ADD COLUMN balance_remaining REAL DEFAULT 0");
    if (!pColNames.includes("method")) db.exec("ALTER TABLE payments ADD COLUMN method TEXT DEFAULT 'UPI'");
    if (!pColNames.includes("payment_type")) db.exec("ALTER TABLE payments ADD COLUMN payment_type TEXT DEFAULT 'full'");
    if (!pColNames.includes("transaction_id")) db.exec("ALTER TABLE payments ADD COLUMN transaction_id TEXT");
    if (!pColNames.includes("payment_status")) db.exec("ALTER TABLE payments ADD COLUMN payment_status TEXT DEFAULT 'Paid'");
    if (!pColNames.includes("notes")) db.exec("ALTER TABLE payments ADD COLUMN notes TEXT");
    if (!pColNames.includes("created_at")) db.exec("ALTER TABLE payments ADD COLUMN created_at TEXT");
    if (!pColNames.includes("updated_at")) db.exec("ALTER TABLE payments ADD COLUMN updated_at TEXT");
  } catch (e) {
    console.warn("Schema migration notice:", e);
  }

  // Seed Admin
  const adminExists = db.prepare("SELECT * FROM admins WHERE username = ?").get("admin");
  const defaultHashedPassword = bcrypt.hashSync("admin123", 10);
  if (!adminExists) {
    db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run("admin", defaultHashedPassword);
  } else {
    db.prepare("UPDATE admins SET password = ? WHERE username = ?").run(defaultHashedPassword, "admin");
  }

  // Seed Seats (A1-A49, B1-B26)
  const seatCount = db.prepare("SELECT COUNT(*) as count FROM seats").get() as { count: number };
  if (seatCount.count !== 75) {
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM seats").run();
      const insertSeat = db.prepare("INSERT INTO seats (id) VALUES (?)");
      for (let i = 1; i <= 49; i++) {
        insertSeat.run(`A${i}`);
      }
      for (let i = 1; i <= 26; i++) {
        insertSeat.run(`B${i}`);
      }
    });
    transaction();
  }

  return db;
}

export function createExpressApp() {
  const app = express();
  const db = getDatabase();

  app.use(cors());
  app.use(express.json());

  // Middleware to normalize Netlify function path prefixes
  app.use((req, _res, next) => {
    if (req.url.startsWith("/.netlify/functions/api")) {
      req.url = req.url.replace("/.netlify/functions/api", "/api");
    }
    next();
  });

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.admin = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Auth Handler
  const handleLogin = (req: express.Request, res: express.Response) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username) as any;
      if (admin && bcrypt.compareSync(password, admin.password)) {
        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: "24h" });
        return res.json({ token });
      } else {
        return res.status(401).json({ error: "Invalid username or password" });
      }
    } catch (err: any) {
      console.error("Login error detail:", err);
      return res.status(500).json({ error: `Internal Server Error: ${err.message || err}` });
    }
  };

  // Attach auth endpoints for multiple path forms
  app.post("/api/auth/login", handleLogin);
  app.post("/api/login", handleLogin);
  app.post("/auth/login", handleLogin);
  app.post("/login", handleLogin);

  // Dashboard Stats
  const getStats = (req: any, res: any) => {
    try {
      const totalSeats = 75;
      const occupiedPaid = db.prepare("SELECT COUNT(*) as count FROM seats WHERE status = 'occupied-paid'").get() as any;
      const occupiedPending = db.prepare("SELECT COUNT(*) as count FROM seats WHERE status = 'occupied-pending'").get() as any;
      const totalStudents = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'active'").get() as any;

      const today = new Date().toISOString().slice(0, 10);
      const currentMonth = today.slice(0, 7);

      // Fees Collected this month
      const monthlyCollection = db.prepare("SELECT SUM(amount) as total FROM payments WHERE date LIKE ?").get(`${currentMonth}%`) as any;
      
      // Today's collections
      const todaysCollection = db.prepare("SELECT SUM(amount) as total FROM payments WHERE date LIKE ?").get(`${today}%`) as any;

      // Total Expected Monthly Revenue from active students
      const totalMonthlyRevenue = db.prepare("SELECT SUM(fees_amount) as total FROM students WHERE status = 'active'").get() as any;

      // Pending Fees (sum of unpaid balances across active students)
      const pendingFeesSum = db.prepare("SELECT SUM(balance_due) as total FROM students WHERE status = 'active' AND balance_due > 0").get() as any;

      // Overdue Fees (fees of students overdue)
      const overdueFeesSum = db.prepare("SELECT SUM(fees_amount) as total FROM students WHERE status = 'active' AND due_date < ?").get(today) as any;

      // Partially Paid count
      const partiallyPaidCount = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'active' AND (balance_due > 0 OR membership_status = 'Partial')").get() as any;

      // Room-wise collections (Room A vs Room B)
      const roomACollection = db.prepare(`
        SELECT SUM(p.amount) as total FROM payments p 
        LEFT JOIN students s ON p.student_id = s.id 
        WHERE (s.seat_id LIKE 'A%' OR s.room = 'Room A') AND p.date LIKE ?
      `).get(`${currentMonth}%`) as any;

      const roomBCollection = db.prepare(`
        SELECT SUM(p.amount) as total FROM payments p 
        LEFT JOIN students s ON p.student_id = s.id 
        WHERE (s.seat_id LIKE 'B%' OR s.room = 'Room B') AND p.date LIKE ?
      `).get(`${currentMonth}%`) as any;

      // Payment method distribution
      const upiTotal = db.prepare("SELECT SUM(amount) as total FROM payments WHERE method = 'UPI' AND date LIKE ?").get(`${currentMonth}%`) as any;
      const cashTotal = db.prepare("SELECT SUM(amount) as total FROM payments WHERE method = 'Cash' AND date LIKE ?").get(`${currentMonth}%`) as any;
      const bankTotal = db.prepare("SELECT SUM(amount) as total FROM payments WHERE method = 'Bank Transfer' AND date LIKE ?").get(`${currentMonth}%`) as any;

      res.json({
        totalSeats,
        occupiedSeats: occupiedPaid.count + occupiedPending.count,
        availableSeats: totalSeats - (occupiedPaid.count + occupiedPending.count),
        totalStudents: totalStudents.count,
        pendingPayments: occupiedPending.count,
        monthlyCollection: monthlyCollection.total || 0,
        todaysCollections: todaysCollection.total || 0,
        totalMonthlyRevenue: totalMonthlyRevenue.total || 0,
        pendingFees: pendingFeesSum.total || 0,
        overdueFees: overdueFeesSum.total || 0,
        partiallyPaidStudents: partiallyPaidCount.count || 0,
        roomWise: {
          roomA: roomACollection.total || 0,
          roomB: roomBCollection.total || 0,
        },
        methodDistribution: {
          upi: upiTotal.total || 0,
          cash: cashTotal.total || 0,
          bank: bankTotal.total || 0,
        }
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to calculate stats" });
    }
  };

  app.get("/api/stats", authenticate, getStats);
  app.get("/stats", authenticate, getStats);

  // Seats
  const getSeats = (req: any, res: any) => {
    const seats = db.prepare(`
      SELECT s.*, st.name as student_name, st.mobile as student_mobile, st.due_date
      FROM seats s
      LEFT JOIN students st ON s.student_id = st.id
    `).all();
    res.json(seats);
  };

  app.get("/api/seats", authenticate, getSeats);
  app.get("/seats", authenticate, getSeats);

  // Students
  app.get(["/api/students", "/students"], authenticate, (req, res) => {
    const students = db.prepare("SELECT * FROM students WHERE status = 'active'").all();
    res.json(students);
  });

  app.post(["/api/students", "/students"], authenticate, (req, res) => {
    const { name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date } = req.body;

    const transaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO students (name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date);

      const studentId = result.lastInsertRowid;
      const isPending = new Date(due_date) < new Date();
      db.prepare("UPDATE seats SET status = ?, student_id = ?, timing = ? WHERE id = ?")
        .run(isPending ? 'occupied-pending' : 'occupied-paid', studentId, timing, seat_id);

      return studentId;
    });

    try {
      const id = transaction();
      res.json({ id });
    } catch (err) {
      res.status(500).json({ error: "Failed to add student" });
    }
  });

  app.put(["/api/students/:id", "/students/:id"], authenticate, (req, res) => {
    const { id } = req.params;
    const { name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date } = req.body;

    const oldStudent = db.prepare("SELECT seat_id FROM students WHERE id = ?").get(id) as any;

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE students 
        SET name = ?, father_name = ?, mobile = ?, seat_id = ?, timing = ?, fees_amount = ?, join_date = ?, due_date = ?
        WHERE id = ?
      `).run(name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date, id);

      if (oldStudent && oldStudent.seat_id !== seat_id) {
        db.prepare("UPDATE seats SET status = 'available', student_id = NULL, timing = NULL WHERE id = ?").run(oldStudent.seat_id);
      }

      const isPending = new Date(due_date) < new Date();
      db.prepare("UPDATE seats SET status = ?, student_id = ?, timing = ? WHERE id = ?")
        .run(isPending ? 'occupied-pending' : 'occupied-paid', id, timing, seat_id);
    });

    transaction();
    res.json({ success: true });
  });

  app.delete(["/api/students/:id", "/students/:id"], authenticate, (req, res) => {
    const { id } = req.params;
    const student = db.prepare("SELECT seat_id FROM students WHERE id = ?").get(id) as any;

    const transaction = db.transaction(() => {
      db.prepare("UPDATE students SET status = 'deleted' WHERE id = ?").run(id);
      if (student?.seat_id) {
        db.prepare("UPDATE seats SET status = 'available', student_id = NULL, timing = NULL WHERE id = ?").run(student.seat_id);
      }
    });

    transaction();
    res.json({ success: true });
  });

  // Payments & Ledger
  app.post(["/api/payments", "/payments"], authenticate, async (req, res) => {
    try {
      const {
        student_id,
        amount,
        original_fee,
        late_fee,
        total_due,
        balance_remaining,
        date,
        method,
        payment_type,
        billing_month,
        next_due_date,
        transaction_id,
        notes,
      } = req.body;

      const student = db.prepare("SELECT * FROM students WHERE id = ?").get(student_id) as any;
      if (!student) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      const studentName = student.name;
      const paymentDate = date || new Date().toISOString().slice(0, 10);
      const createdAt = new Date().toISOString();
      const pStatus = balance_remaining > 0 ? "Partially Paid" : "Paid";

      const transaction = db.transaction(() => {
        // 1. Insert permanent payment record
        const insertRes = db.prepare(`
          INSERT INTO payments (
            student_id, student_name, billing_month, amount, original_fee, late_fee,
            total_due, balance_remaining, method, payment_type, transaction_id,
            invoice_id, date, payment_status, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          student_id,
          studentName,
          billing_month || new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
          amount || 0,
          original_fee || student.fees_amount || 0,
          late_fee || 0,
          total_due || amount || 0,
          balance_remaining || 0,
          method || "UPI",
          payment_type || "full",
          transaction_id || `TXN-${Date.now()}`,
          "PENDING",
          paymentDate,
          pStatus,
          notes || "",
          createdAt,
          createdAt
        );

        const paymentId = insertRes.lastInsertRowid;
        // Unique receipt number format: GL-2026-000145
        const yearStr = new Date().getFullYear();
        const invoice_id = `GL-${yearStr}-${String(paymentId).padStart(6, "0")}`;
        const txn_id = transaction_id || `TXN-${yearStr}-${String(paymentId).padStart(6, "0")}`;

        db.prepare("UPDATE payments SET invoice_id = ?, transaction_id = ? WHERE id = ?").run(invoice_id, txn_id, paymentId);

        // 2. Update Student Profile state
        const nextDue = next_due_date || student.due_date;
        db.prepare(`
          UPDATE students 
          SET due_date = ?, balance_due = ?, membership_status = ? 
          WHERE id = ?
        `).run(nextDue, balance_remaining || 0, balance_remaining > 0 ? "Partial" : "Active", student_id);

        // 3. Update Seat status
        const today = new Date().toISOString().slice(0, 10);
        const isPending = balance_remaining > 0 || nextDue < today;
        if (student.seat_id) {
          db.prepare("UPDATE seats SET status = ? WHERE id = ?")
            .run(isPending ? 'occupied-pending' : 'occupied-paid', student.seat_id);
        }

        return {
          id: paymentId,
          invoice_id,
          transaction_id: txn_id,
          student_id,
          student_name: studentName,
          amount,
          original_fee: original_fee || student.fees_amount,
          late_fee: late_fee || 0,
          total_due: total_due || amount,
          balance_remaining: balance_remaining || 0,
          date: paymentDate,
          method: method || "UPI",
          payment_type: payment_type || "full",
          billing_month: billing_month || new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
          payment_status: pStatus,
          notes: notes || "",
        };
      });

      const paymentRecord = transaction();
      return res.json(paymentRecord);
    } catch (err: any) {
      console.error("Payment processing error:", err);
      return res.status(500).json({ error: "Failed to record payment" });
    }
  });

  // Get Payment History for a specific student
  app.get(["/api/payments/history/:student_id", "/payments/history/:student_id"], authenticate, (req, res) => {
    try {
      const { student_id } = req.params;
      const history = db.prepare(`
        SELECT p.*, s.seat_id, s.room, s.timing, s.mobile, s.father_name
        FROM payments p
        LEFT JOIN students s ON p.student_id = s.id
        WHERE p.student_id = ?
        ORDER BY p.id DESC
      `).all(student_id);
      res.json(history || []);
    } catch (err) {
      // Fallback simple query
      const history = db.prepare("SELECT * FROM payments WHERE student_id = ? ORDER BY id DESC").all(req.params.student_id);
      res.json(history || []);
    }
  });

  // Get All Payment History Records across system
  app.get(["/api/payments/all", "/payments/all"], authenticate, (req, res) => {
    try {
      const payments = db.prepare(`
        SELECT p.*, s.seat_id, s.room, s.timing, s.mobile
        FROM payments p
        LEFT JOIN students s ON p.student_id = s.id
        ORDER BY p.id DESC
      `).all();
      res.json(payments || []);
    } catch (err) {
      const payments = db.prepare("SELECT * FROM payments ORDER BY id DESC").all();
      res.json(payments || []);
    }
  });

  // Reminders Logging
  app.get(["/api/reminders", "/reminders"], authenticate, (req, res) => {
    try {
      const logs = db.prepare("SELECT * FROM reminders ORDER BY id DESC LIMIT 100").all();
      res.json(logs || []);
    } catch (err) {
      res.json([]);
    }
  });

  app.post(["/api/reminders", "/reminders"], authenticate, (req, res) => {
    try {
      const { student_id, student_name, mobile, channel, message, status, timestamp } = req.body;
      const result = db.prepare(`
        INSERT INTO reminders (student_id, student_name, mobile, channel, message, status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(student_id, student_name, mobile, channel, message, status || "sent", timestamp || new Date().toISOString());
      
      res.json({ id: result.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to log reminder" });
    }
  });

  app.post(["/api/check-pending", "/check-pending"], authenticate, (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
      UPDATE seats 
      SET status = 'occupied-pending'
      WHERE student_id IN (SELECT id FROM students WHERE due_date < ? AND status = 'active')
      AND status = 'occupied-paid'
    `).run(today);
    res.json({ success: true });
  });

  return app;
}
