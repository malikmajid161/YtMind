import test from "node:test";
import assert from "node:assert/strict";
import { listModels } from "../src/groq.js";
test("model discovery excludes non-chat models and keeps account availability explicit", async () => {
  const models = await listModels(
    "private",
    async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "openai/gpt-oss-120b" },
            { id: "qwen/qwen3.8-27b" },
            { id: "whisper-large-v3" },
            { id: "guard-model" },
          ],
        }),
      ),
  );
  assert.deepEqual(models, ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]);
});
test("model discovery requires a key and handles provider rejection", async () => {
  await assert.rejects(listModels(""), /Enter your Groq key/);
  await assert.rejects(
    listModels("private", async () => new Response("", { status: 401 })),
    /rejected/,
  );
});
