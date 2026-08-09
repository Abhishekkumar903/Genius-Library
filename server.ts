import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { createExpressApp } from "./src/serverApp.js";

dotenv.config();

async function startServer() {
  const app = createExpressApp();
  const PORT = 3000;

  // Vite middleware for development / production static fallback
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(expressStatic(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Helper for static files in ESM production
import express from "express";
const expressStatic = express.static;

startServer();

