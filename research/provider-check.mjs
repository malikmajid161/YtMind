try {
  process.loadEnvFile(".env.local");
} catch {}
const key = process.env.GROQ_API_KEY;
if (!key) {
  console.error("Configure the local Groq key first.");
  process.exit(1);
}
const response = await fetch("https://api.groq.com/openai/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
  signal: AbortSignal.timeout(25000),
});
const data = await response.json().catch(() => ({}));
const clean = (value) =>
  String(value || "")
    .replaceAll(key, "[REDACTED]")
    .replace(/gsk_[A-Za-z0-9]+/g, "[REDACTED]")
    .slice(0, 400);
console.log(
  JSON.stringify({
    status: response.status,
    models: (data.data || []).map((m) => m.id),
    error: {
      code: clean(data.error?.code),
      type: clean(data.error?.type),
      message: clean(data.error?.message),
    },
  }),
);
