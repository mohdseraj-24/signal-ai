import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { config, authConfigured } from "../config.js";
import { needDb } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const publicUser = u => ({ id: String(u._id), name: u.name, email: u.email });
const sign = u => jwt.sign({ sub: String(u._id) }, config.jwtSecret, { expiresIn: "7d" });

router.use((_req, res, next) => {
  if (!authConfigured()) {
    return res.status(503).json({ error: "Login is not enabled on this server yet." });
  }
  next();
});
router.use(needDb);

router.post("/register", limiter, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (name.length < 1 || name.length > 60) return res.status(400).json({ error: "Enter your name (max 60 characters)." });
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ error: "Password is too long (max 72 bytes)." });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    return res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "An account with this email already exists." });
    console.error("register error:", err.message);
    return res.status(500).json({ error: "Could not create account. Please try again." });
  }
});

router.post("/login", limiter, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Enter your email and password." });

  try {
    const user = await User.findOne({ email });
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: "Invalid email or password." });
    return res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    console.error("login error:", err.message);
    return res.status(500).json({ error: "Could not log in. Please try again." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });
    return res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
});

export default router;
