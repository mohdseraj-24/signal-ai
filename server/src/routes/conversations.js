import { Router } from "express";
import mongoose from "mongoose";
import { needDb } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { Conversation } from "../models/Conversation.js";
import { wrap } from "../middleware/wrap.js";

const router = Router();
router.use(requireAuth, needDb);

router.get("/", wrap(async (req, res) => {
  const items = await Conversation.find({ user: req.userId })
    .select("title updatedAt")
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  res.json({ conversations: items.map(c => ({ id: String(c._id), title: c.title, updatedAt: c.updatedAt })) });
}));

router.get("/:id", wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Chat not found." });
  const convo = await Conversation.findOne({ _id: req.params.id, user: req.userId }).lean();
  if (!convo) return res.status(404).json({ error: "Chat not found." });
  res.json({ id: String(convo._id), title: convo.title, messages: convo.messages });
}));

router.delete("/:id", wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Chat not found." });
  const result = await Conversation.deleteOne({ _id: req.params.id, user: req.userId });
  if (!result.deletedCount) return res.status(404).json({ error: "Chat not found." });
  res.json({ ok: true });
}));

export default router;
