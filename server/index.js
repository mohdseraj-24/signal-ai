import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, authConfigured } from "./src/config.js";
import { connectDb, dbReady } from "./src/db.js";
import authRoutes from "./src/routes/auth.js";
import chatRoutes from "./src/routes/chat.js";
import conversationRoutes from "./src/routes/conversations.js";

const app = express();
app.set("trust proxy", 1); // Render/Vercel proxy ke peeche sahi client IP ke liye
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: production mein sirf CLIENT_ORIGIN wale sites allowed
if (config.clientOrigins.length) {
  app.use(cors({ origin: config.clientOrigins }));
} else if (!config.isProd) {
  app.use(cors());
} else {
  console.warn("CLIENT_ORIGIN not set - cross-origin browser requests will be blocked.");
}
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, db: dbReady() }));

app.get("/api/config", (_req, res) => {
  res.json({
    authEnabled: authConfigured(),
    defaultProvider: config.defaultProvider,
    providers: Object.values(config.providers).map(p => ({
      id: p.id,
      label: p.label,
      models: p.models,
      defaultModel: p.defaultModel
    }))
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// Optional: single-service deploy (client build ko Express se serve karo)
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../client/dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body." });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request too large." });
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

if (!config.defaultProvider) console.warn("No AI provider key found. Set GROQ_API_KEY (or OPENAI_API_KEY).");
connectDb(config.mongoUri);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Signal AI API running on port ${config.port}`);
  console.log(`Providers: ${Object.keys(config.providers).join(", ") || "none"} | Login: ${authConfigured() ? "on" : "off"}`);
});
