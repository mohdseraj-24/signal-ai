import mongoose from "mongoose";

export const dbReady = () => mongoose.connection.readyState === 1;

export function connectDb(uri) {
  if (!uri) {
    console.warn("MONGODB_URI not set - guest-only mode (login & chat history disabled).");
    return;
  }
  mongoose.set("strictQuery", true);
  const attempt = async () => {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      console.log("MongoDB connected");
    } catch (err) {
      console.error(`MongoDB connection failed: ${err.message} - retrying in 15s`);
      setTimeout(attempt, 15000);
    }
  };
  attempt(); // server ko block nahi karta
}

export function needDb(_req, res, next) {
  if (!dbReady()) {
    return res.status(503).json({ error: "Database is connecting. Please try again in a few seconds." });
  }
  next();
}
