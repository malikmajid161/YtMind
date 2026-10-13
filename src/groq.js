import { defaults } from "./core.js";
export async function listModels(apiKey, fetcher = fetch) {
  if (!apiKey)
    throw new Error("Enter your Groq key before checking the connection.");
  let response;
  try {
    response = await fetcher("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new Error(
      "Groq could not be reached. Check your connection and retry.",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Groq rejected your key. Update it in Settings."
        : `Model discovery failed (${response.status}). Retry.`,
    );
  const data = await response.json();
  return (data.data || [])
    .map((m) => m.id)
    .filter(
      (id) =>
        typeof id === "string" &&
        !/whisper|orpheus|guard|tts|embedding/i.test(id),
    );
}
export async function complete(
  settings,
  system,
  user,
  { json = false, model = settings.model, fetcher = fetch } = {},
) {
  if (!settings.apiKey)
    throw new Error("Add your Groq API key in Settings to generate.");
  let response;
  try {
    response = await fetcher(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        signal: AbortSignal.timeout(25000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: model || defaults.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          max_tokens: 2400,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
      },
    );
  } catch {
    throw new Error(
      "Groq could not be reached or timed out. Check your connection and retry.",
    );
  }
  if (!response.ok) {
    const messages = {
      401: "Groq rejected your key. Update it in Settings.",
      429: `Groq rate limit reached. Retry after ${response.headers.get("retry-after") || "a short wait"}.`,
      413: "The source is too large. Try a narrower question.",
    };
    throw new Error(
      messages[response.status] ||
        `Groq request failed (${response.status}). Check the model in Settings and retry.`,
    );
  }
  const data = await response.json(),
    text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response. Retry.");
  if (!json) return text;
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("Groq returned invalid JSON. Retry.");
  }
}
