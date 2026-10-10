import dotenv from "dotenv";
dotenv.config();

const list = (value, fallback) =>
  value ? value.split(",").map(s => s.trim()).filter(Boolean) : fallback;
const clean = value => (value || "").trim();

const isProd = process.env.NODE_ENV === "production";

const allProviders = {
  groq: {
    id: "groq",
    label: "Groq",
    baseUrl: clean(process.env.GROQ_BASE_URL) || "https://api.groq.com/openai/v1",
    apiKey: clean(process.env.GROQ_API_KEY),
    models: list(process.env.GROQ_MODELS, ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"])
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: clean(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1",
    apiKey: clean(process.env.OPENAI_API_KEY) || clean(process.env.API_KEY),
    models: list(process.env.OPENAI_MODELS || process.env.MODEL, ["gpt-4o-mini"])
  }
};

// Sirf wahi providers jinki API key set hai
const providers = Object.fromEntries(
  Object.entries(allProviders)
    .filter(([, p]) => p.apiKey)
    .map(([id, p]) => [id, { ...p, defaultModel: p.models[0] }])
);

const requestedDefault = clean(process.env.DEFAULT_PROVIDER).toLowerCase();
const defaultProvider = providers[requestedDefault]
  ? requestedDefault
  : Object.keys(providers)[0] || null;

const jwtSecret = clean(process.env.JWT_SECRET) || (isProd ? "" : "dev-only-secret-change-me");

export const config = {
  port: Number(process.env.PORT || 8000),
  isProd,
  mongoUri: clean(process.env.MONGODB_URI),
  jwtSecret,
  clientOrigins: list(process.env.CLIENT_ORIGIN, []).map(o => o.replace(/\/+$/, "")),
  maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || 700),
  providers,
  defaultProvider
};

// Login tabhi available hai jab DB URI aur JWT secret dono set hon
export const authConfigured = () => Boolean(config.mongoUri && config.jwtSecret);
