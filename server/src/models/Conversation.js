import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 20000 }
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New chat", maxlength: 80 },
    messages: { type: [messageSchema], default: [] }
  },
  { timestamps: true }
);

export const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
