/**
 * Server-side environment. Read through this module only — never process.env
 * directly in app code, so a missing secret fails loudly at boot rather than
 * silently degrading auth.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  sessionMaxAge: Number(optional("SESSION_MAX_AGE", "28800")),
  mlMode: optional("ML_MODE", "rules") as "rules" | "ml",
  mlServiceUrl: optional("ML_SERVICE_URL", "http://localhost:8000"),
  notifyMode: optional("NOTIFY_MODE", "console") as "console" | "email",
  isProduction: process.env.NODE_ENV === "production",
};

if (env.sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48",
  );
}
