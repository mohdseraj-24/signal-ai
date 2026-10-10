import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { dbReady } from "../db.js";
import { optionalAuth } from "../middleware/auth.js";
import { Conversation } from "../models/Conversation.js";
import { wrap } from "../middleware/wrap.js";

const router = Router();

const SYSTEM_PROMPT =
  "Act as a precise and efficient assistant. Answer every query concisely and directly, " +
  "using the minimum words necessary without losing clarity. Prioritize facts, clear reasoning, " +
  "and actionable feedback. Do not invent facts. Reply in the same language the user writes in. " +
  "Use Markdown (short lists, code blocks) only when it helps.";

const MAX_MESSAGES = 100; // client se aane wali history ki limit
const CONTEXT_MESSAGES = 20; // model ko sirf last N messages bheje jaate hain

// Free guests ke liye fair-use limit (API key ko abuse se bachata hai); logged-in users ko zyada
const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: req => Boolean(req.userId),
  message: { error: "Free limit reached for now. Please wait a few minutes or log in for a higher limit." }
});
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: req => !req.userId,
  keyGenerator: req => `user:${req.userId}`,
  message: { error: "Too many requests. Please wait a few minutes." }
});

function validMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(
      m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string" &&
        m.content.trim() &&
        m.content.length <= 20000
    ) &&
    messages[messages.length - 1].role === "user"
  );
}

router.post(
  "/",
  optionalAuth,
  guestLimiter,
  userLimiter,
  wrap(async (req, res) => {
    const { messages, provider: providerId, model: modelId, conversationId } = req.body ?? {};

    if (!validMessages(messages)) {
      return res.status(400).json({ error: "Send 1-100 valid messages, ending with a user message." });
    }
    if (!config.defaultProvider) {
      return res.status(503).json({ error: "No AI provider configured. Set GROQ_API_KEY on the server." });
    }

    const provider = config.providers[providerId || config.defaultProvider];
    if (!provider) return res.status(400).json({ error: "Selected AI provider is not available." });
    const model = modelId || provider.defaultModel;
    if (!provider.models.includes(model)) {
      return res.status(400).json({ error: "Selected model is not available for this provider." });
    }

    const cleanMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const base = provider.baseUrl.replace(/\/+$/, "");

    let reply;
    try {
      const upstream = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...cleanMessages.slice(-CONTEXT_MESSAGES)],
          max_tokens: config.maxOutputTokens,
          temperature: 0.4
        }),
        signal: AbortSignal.timeout(60000)
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error(`${provider.label} error ${upstream.status}:`, data.error?.message);
        const rateLimited = upstream.status === 429;
        return res.status(502).json({
          error: rateLimited
            ? `${provider.label} is rate-limited right now. Try again in a moment or switch model.`
            : data.error?.message || `${provider.label} request failed.`
        });
      }
      reply = data.choices?.[0]?.message?.content;
    } catch (err) {
      console.error("provider fetch failed:", err.message);
      return res.status(502).json({ error: `Cannot reach ${provider.label}. Please try again.` });
    }

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "The AI returned an empty response. Please try again." });
    }
    reply = reply.trim();

    // Logged-in user ho to chat MongoDB mein save karo (failure reply ko rokta nahi)
    let savedId = null;
    let title = null;
    if (req.userId && dbReady()) {
      try {
        const full = [...cleanMessages, { role: "assistant", content: reply }];
        let convo = null;
        if (conversationId && mongoose.isValidObjectId(conversationId)) {
          convo = await Conversation.findOne({ _id: conversationId, user: req.userId });
        }
        if (convo) {
          convo.messages = full;
        } else {
          const firstUser = cleanMessages.find(m => m.role === "user")?.content || "New chat";
          convo = new Conversation({
            user: req.userId,
            title: firstUser.replace(/\s+/g, " ").slice(0, 48),
            messages: full
          });
        }
        await convo.save();
        savedId = String(convo._id);
        title = convo.title;
      } catch (err) {
        console.error("save conversation failed:", err.message);
      }
    }

    return res.json({ reply, conversationId: savedId, title, saved: Boolean(savedId) });
  })
);

export default router;
