import jwt from "jsonwebtoken";
import { config } from "../config.js";

// Token valid ho to req.userId set karta hai, warna guest ki tarah aage badhne deta hai
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token && config.jwtSecret) {
    try {
      req.userId = jwt.verify(token, config.jwtSecret).sub;
    } catch {
      /* invalid/expired token = guest */
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.userId) return res.status(401).json({ error: "Please log in to continue." });
    next();
  });
}
