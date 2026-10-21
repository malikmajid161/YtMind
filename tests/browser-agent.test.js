import test from "node:test";
import assert from "node:assert/strict";
import { agentRequest, validateAgentTask } from "../src/browser-agent.js";
test("browser agent rejects unsupported providers and oversized or mismatched uploads", () => {
  assert.throws(() =>
    validateAgentTask({ provider: "other", prompt: "hello" }),
  );
  assert.throws(() =>
    validateAgentTask({
      provider: "claude",
      prompt: "hello",
      file: { name: "a.txt", size: 4, data: "YQ==" },
    }),
  );
  const task = validateAgentTask({
    provider: "claude",
    prompt: "hello",
    file: { name: "a.txt", size: 1, data: "YQ==" },
  });
  assert.equal(task.file.name, "a.txt");
});
test("provider tasks open a new tab and never resubmit after sending", async () => {
  const phases = [];
  let origin = "https://chatgpt.com/c/task";
  const api = {
    tabs: {
      create: async (x) => {
        assert.equal(x.url, "https://chatgpt.com/");
        return { id: 19 };
      },
      get: async () => ({ url: origin, status: "complete" }),
    },
    scripting: {
      executeScript: async (x) => {
        const p = x.args[0];
        phases.push(p.phase);
        return [
          {
            result:
              p.phase === "send"
                ? { status: "sent", baseline: 0, message: "sent" }
                : { status: "waiting", text: "Result", streaming: false },
          },
        ];
      },
    },
  };
  const job = await agentRequest(
    { operation: "create", provider: "chatgpt", prompt: "Draft my assignment" },
    api,
  );
  assert.equal(job.tabId, 19);
  assert.equal(job.prompt, undefined);
  for (let i = 0; i < 5; i++)
    await agentRequest({ operation: "status", jobId: job.id }, api);
  assert.deepEqual(phases, ["send", "read", "read", "read", "read"]);
  assert.equal(
    (await agentRequest({ operation: "status", jobId: job.id }, api)).status,
    "complete",
  );
  const second = await agentRequest(
    { operation: "create", provider: "chatgpt", prompt: "Task" },
    api,
  );
  origin = "https://example.com/";
  assert.equal(
    (await agentRequest({ operation: "status", jobId: second.id }, api)).status,
    "attention",
  );
  assert.equal(phases.length, 5);
});
test("an unavailable Send control pauses instead of retrying an ambiguous submission", async () => {
  let calls = 0;
  const api = {
    tabs: {
      create: async () => ({ id: 1 }),
      get: async () => ({ url: "https://claude.ai/new" }),
    },
    scripting: {
      executeScript: async () => {
        calls++;
        return [{ result: { status: "prepared", message: "Send manually" } }];
      },
    },
  };
  const job = await agentRequest(
    { operation: "create", provider: "claude", prompt: "Task" },
    api,
  );
  await agentRequest({ operation: "status", jobId: job.id }, api);
  await agentRequest({ operation: "status", jobId: job.id }, api);
  assert.equal(calls, 1);
  await agentRequest({ operation: "cancel", jobId: job.id }, api);
  assert.equal(
    (await agentRequest({ operation: "status", jobId: job.id }, api)).status,
    "cancelled",
  );
});
