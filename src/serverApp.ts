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
    const totalSeats = 75;
    const occupiedPaid = db.prepare("SELECT COUNT(*) as count FROM seats WHERE status = 'occupied-paid'").get() as any;
    const occupiedPending = db.prepare("SELECT COUNT(*) as count FROM seats WHERE status = 'occupied-pending'").get() as any;
    const totalStudents = db.prepare("SELECT COUNT(*) as count FROM students WHERE status = 'active'").get() as any;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyCollection = db.prepare("SELECT SUM(amount) as total FROM payments WHERE date LIKE ?").get(`${currentMonth}%`) as any;

    res.json({
      totalSeats,
      occupiedSeats: occupiedPaid.count + occupiedPending.count,
      availableSeats: totalSeats - (occupiedPaid.count + occupiedPending.count),
      totalStudents: totalStudents.count,
      pendingPayments: occupiedPending.count,
      monthlyCollection: monthlyCollection.total || 0,
    });
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

  // Payments
  app.post(["/api/payments", "/payments"], authenticate, async (req, res) => {
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
      res.json({ invoice_id });
    } catch (err) {
      res.status(500).json({ error: "Payment failed" });
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
