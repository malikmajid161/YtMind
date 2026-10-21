import { defaults } from "./core.js";
export async function listModels(apiKey, fetcher = fetch) {
  if (!apiKey)
    throw new Error("Enter your Groq key before checking the connection.");
  let response;
  try {
    response = await fetcher("https://api.groq.com/openai/v1/models", {
      credentials: "omit",
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
  {
    json = false,
    jsonSchema,
    maxTokens = 2400,
    model = settings.model,
    fetcher = fetch,
    retries = 2,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  if (!settings.apiKey)
    throw new Error("Add your Groq API key in Settings to generate.");
  let response, providerError;
  let formatRetried = false;
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      response = await fetcher(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          credentials: "omit",
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
            max_tokens: maxTokens,
            ...(/^openai\/gpt-oss-/.test(model || defaults.model) && json
              ? { reasoning_effort: "low" }
              : {}),
            ...(json
              ? {
                  response_format:
                    jsonSchema &&
                    /^openai\/gpt-oss-/.test(model || defaults.model)
                      ? {
                          type: "json_schema",
                          json_schema: {
                            name: "video_analysis",
                            strict: true,
                            schema: jsonSchema,
                          },
                        }
                      : { type: "json_object" },
                }
              : {}),
          }),
        },
      );
      if (response.status === 400) {
        providerError = await response
          .clone()
          .json()
          .catch(() => ({}));
        if (
          json &&
          !formatRetried &&
          attempt < retries &&
          providerError.error?.code === "json_validate_failed"
        ) {
          formatRetried = true;
          continue;
        }
      }
      if (response.status !== 429 || attempt === retries) break;
      const delay = Number(response.headers.get("retry-after"));
      await wait(
        Math.min(
          30000,
          Math.max(
            1000,
            Number.isFinite(delay) && delay > 0
              ? delay * 1000
              : 2000 * 2 ** attempt,
          ),
        ),
      );
    }
  } catch {
    throw new Error(
      "Groq could not be reached or timed out. Check your connection and retry.",
    );
  }
  if (!response.ok) {
    const code = providerError?.error?.code;
    const detail = String(providerError?.error?.message || "");
    const messages = {
      401: "Groq rejected your key. Update it in Settings.",
      429: `Groq rate limit reached. Retry after ${response.headers.get("retry-after") || "a short wait"}.`,
      413: "The source is too large. Try a narrower question.",
      400:
        code === "json_validate_failed"
          ? "Groq could not produce the required analysis JSON after retrying. Your source is saved; retry analysis."
          : /model.*(decommission|not found|not exist|unsupported)|model_decommissioned/i.test(
                `${code} ${detail}`,
              )
            ? "The selected Groq model is unavailable. Use Check connection in Settings and select an available chat model."
            : /context|token.*limit|too.*(large|long)/i.test(detail)
              ? "Groq rejected this source section because it exceeds the model token limit. Try a model with more context."
              : "Groq rejected the analysis request (400). Your source is saved. Check model availability in Settings and retry.",
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
