import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("library.db");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS seats (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'available', -- 'available', 'occupied-paid', 'occupied-pending'
    student_id INTEGER,
    timing TEXT, -- 'full', 'half', 'custom'
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
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    amount REAL,
    date TEXT,
    invoice_id TEXT,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );
`);

// Seed Admin if not exists
const adminExists = db.prepare("SELECT * FROM admins WHERE username = ?").get("admin");
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run("admin", hashedPassword);
}

// Seed Seats if not exists or if count is wrong
const seatCount = db.prepare("SELECT COUNT(*) as count FROM seats").get() as { count: number };
if (seatCount.count !== 75) {
  // We only reset if it's not 75 to avoid constant resets, 
  // but for this update we need to ensure A1-A49 and B1-B26
  const transaction = db.transaction(() => {
    // Optional: Only delete if you want a clean slate. 
    // If there are students assigned, this might be destructive.
    // However, the user requested a specific structure change.
    db.prepare("DELETE FROM seats").run(); 
    
    const insertSeat = db.prepare("INSERT INTO seats (id) VALUES (?)");
    // Room A: A1-A49
    for (let i = 1; i <= 49; i++) {
      insertSeat.run(`A${i}`);
    }
    // Room B: B1-B26
    for (let i = 1; i <= 26; i++) {
      insertSeat.run(`B${i}`);
    }
  });
  transaction();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

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

  // Auth Routes
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username) as any;
    if (admin && bcrypt.compareSync(password, admin.password)) {
      const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: "24h" });
      res.json({ token });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Dashboard Stats
  app.get("/api/stats", authenticate, (req, res) => {
    const totalSeats = 75;
    const occupiedPaid = db.prepare("SELECT COUNT(*) as count FROM seats WHERE status = 'occupied-paid'").get() as any;
    const occupiedPending = db.prepare("SELECT COUNT(*) as count FROM seats WHERE status = 'occupied-pending'").get() as any;
    const totalStudents = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'active'").get() as any;
    
    // Monthly collection
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyCollection = db.prepare("SELECT SUM(amount) as total FROM payments WHERE date LIKE ?").get(`${currentMonth}%`) as any;

    res.json({
      totalSeats,
      occupiedSeats: occupiedPaid.count + occupiedPending.count,
      availableSeats: totalSeats - (occupiedPaid.count + occupiedPending.count),
      totalStudents: totalStudents.count,
      pendingPayments: occupiedPending.count,
      monthlyCollection: monthlyCollection.total || 0
    });
  });

  // Seat Routes
  app.get("/api/seats", authenticate, (req, res) => {
    const seats = db.prepare(`
      SELECT s.*, st.name as student_name, st.mobile as student_mobile, st.due_date
      FROM seats s
      LEFT JOIN students st ON s.student_id = st.id
    `).all();
    res.json(seats);
  });

  // Student Routes
  app.get("/api/students", authenticate, (req, res) => {
    const students = db.prepare("SELECT * FROM students WHERE status = 'active'").all();
    res.json(students);
  });

  app.post("/api/students", authenticate, (req, res) => {
    const { name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date } = req.body;
    
    const transaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO students (name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date);
      
      const studentId = result.lastInsertRowid;
      
      // Update seat status
      // Logic: if due_date is in past, mark pending. For new student, usually paid or pending.
      // Let's assume paid for now or check date.
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

  app.put("/api/students/:id", authenticate, (req, res) => {
    const { id } = req.params;
    const { name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date } = req.body;
    
    const oldStudent = db.prepare("SELECT seat_id FROM students WHERE id = ?").get(id) as any;

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE students 
        SET name = ?, father_name = ?, mobile = ?, seat_id = ?, timing = ?, fees_amount = ?, join_date = ?, due_date = ?
        WHERE id = ?
      `).run(name, father_name, mobile, seat_id, timing, fees_amount, join_date, due_date, id);

      // If seat changed, free old seat
      if (oldStudent.seat_id !== seat_id) {
        db.prepare("UPDATE seats SET status = 'available', student_id = NULL, timing = NULL WHERE id = ?").run(oldStudent.seat_id);
      }

      const isPending = new Date(due_date) < new Date();
      db.prepare("UPDATE seats SET status = ?, student_id = ?, timing = ? WHERE id = ?")
        .run(isPending ? 'occupied-pending' : 'occupied-paid', id, timing, seat_id);
    });

    transaction();
    res.json({ success: true });
  });

  app.delete("/api/students/:id", authenticate, (req, res) => {
    const { id } = req.params;
    const student = db.prepare("SELECT seat_id FROM students WHERE id = ?").get(id) as any;
    
    const transaction = db.transaction(() => {
      db.prepare("UPDATE students SET status = 'deleted' WHERE id = ?").run(id);
      db.prepare("UPDATE seats SET status = 'available', student_id = NULL, timing = NULL WHERE id = ?").run(student.seat_id);
    });

    transaction();
    res.json({ success: true });
  });

  // Mock SMS Function
  const sendSMS = async (mobile: string, message: string) => {
    console.log(`[SMS to ${mobile}]: ${message}`);
    // Real implementation for Fast2SMS or Twilio would go here:
    /*
    if (process.env.FAST2SMS_API_KEY) {
      await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: { "authorization": process.env.FAST2SMS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ message, route: "q", numbers: mobile })
      });
    }
    */
  };

  // Payment Routes
  app.post("/api/payments", authenticate, async (req, res) => {
    const { student_id, amount, date, next_due_date } = req.body;
    const invoice_id = `INV-${Date.now()}`;

    const transaction = db.transaction(() => {
      db.prepare("INSERT INTO payments (student_id, amount, date, invoice_id) VALUES (?, ?, ?, ?)")
        .run(student_id, amount, date, invoice_id);
      
      db.prepare("UPDATE students SET due_date = ? WHERE id = ?").run(next_due_date, student_id);
      
      const student = db.prepare("SELECT * FROM students WHERE id = ?").get(student_id) as any;
      const isPending = new Date(next_due_date) < new Date();
      db.prepare("UPDATE seats SET status = ? WHERE id = ?")
        .run(isPending ? 'occupied-pending' : 'occupied-paid', student.seat_id);
        
      return student;
    });

    try {
      const student = transaction();
      await sendSMS(student.mobile, `Dear ${student.name}, payment of ₹${amount} received. Next due date: ${next_due_date}. Thank you!`);
      res.json({ invoice_id });
    } catch (err) {
      res.status(500).json({ error: "Payment failed" });
    }
  });

  // Cron-like check for pending payments (can be triggered by dashboard load)
  app.post("/api/check-pending", authenticate, (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
      UPDATE seats 
      SET status = 'occupied-pending'
      WHERE student_id IN (SELECT id FROM students WHERE due_date < ? AND status = 'active')
      AND status = 'occupied-paid'
    `).run(today);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
