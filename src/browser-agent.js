const providers = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
};
const jobs = new Map();
export function validateAgentTask(m) {
  if (!providers[m.provider]) throw new Error("Choose Claude or ChatGPT.");
  const prompt = String(m.prompt || "").trim();
  if (!prompt || prompt.length > 20000)
    throw new Error("Write a task of 1-20,000 characters.");
  let file = null;
  if (m.file) {
    if (
      !/\.(pdf|docx|txt|md|csv)$/i.test(m.file.name || "") ||
      !Number.isFinite(m.file.size) ||
      m.file.size < 1 ||
      m.file.size > 8 * 1024 * 1024 ||
      typeof m.file.data !== "string" ||
      m.file.data.length > 11200000 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(m.file.data)
    )
      throw new Error(
        "Upload a PDF, DOCX, TXT, Markdown or CSV file up to 8 MB.",
      );
    const actual = atob(m.file.data).length;
    if (actual !== m.file.size)
      throw new Error("The attachment is incomplete.");
    file = {
      name: m.file.name.slice(0, 180),
      type: String(m.file.type || "application/octet-stream").slice(0, 100),
      size: m.file.size,
      data: m.file.data,
    };
  }
  return { provider: m.provider, prompt, file };
}
// Executed only on the chosen provider tab, with task data explicitly supplied
// by the user. Never reads cookies, password fields, or other conversations.
export function providerStep(payload) {
  const visible = (e) => e && e.getClientRects().length && !e.disabled;
  const composer = [
    ...document.querySelectorAll(
      '#prompt-textarea,textarea[placeholder],[contenteditable="true"].ProseMirror,[contenteditable="true"][role="textbox"]',
    ),
  ].find(visible);
  if (!composer)
    return {
      status: "attention",
      message:
        "Sign in or finish the security check in the new tab, then click Continue.",
    };
  const assistants = () =>
    [
      ...document.querySelectorAll(
        payload.provider === "chatgpt"
          ? '[data-message-author-role="assistant"]'
          : '.font-claude-response,[data-testid="assistant-message"]',
      ),
    ].filter(visible);
  if (payload.phase === "read") {
    const replies = assistants();
    const fresh = replies.slice(payload.baseline);
    const text = fresh
      .map((e) => e.innerText)
      .join("\n\n")
      .trim();
    const streaming = [
      ...document.querySelectorAll(
        'button[aria-label*="Stop"],button[data-testid="stop-button"]',
      ),
    ].some(visible);
    return {
      status: "waiting",
      text,
      streaming,
      message: text
        ? "Receiving the response..."
        : "Waiting for the provider's response. Open its tab if it needs attention.",
    };
  }
  if (payload.phase === "attach") {
    const input = document.querySelector('input[type="file"]');
    if (!input)
      return {
        status: "attention",
        message:
          "Open the attachment control in the provider tab, then click Continue. Nothing has been sent.",
      };
    const bytes = Uint8Array.from(atob(payload.file.data), (c) =>
      c.charCodeAt(0),
    );
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([bytes], payload.file.name, { type: payload.file.type }),
    );
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      status: "attached",
      message: "Attachment selected. Waiting for the provider to accept it.",
    };
  }
  if (
    payload.phase === "send" &&
    payload.fileName &&
    !document.body.innerText.includes(payload.fileName)
  )
    return {
      status: "attention",
      message:
        "The attachment is not visibly confirmed yet. Check it in the provider tab, then Continue.",
    };
  const current = (composer.value ?? composer.innerText ?? "").trim();
  if (current && current !== payload.prompt)
    return {
      status: "attention",
      message:
        "The provider has an existing draft. Clear it in the new tab, then Continue.",
    };
  if (current !== payload.prompt) {
    composer.focus();
    if (composer.tagName === "TEXTAREA") {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set.call(composer, payload.prompt);
      composer.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      document.execCommand("insertText", false, payload.prompt);
      composer.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: payload.prompt,
        }),
      );
    }
  }
  const send = [
    ...document.querySelectorAll(
      'button[data-testid="send-button"],button[aria-label="Send message"],button[aria-label="Send prompt"],button[aria-label="Send Message"]',
    ),
  ].find(visible);
  if (!send)
    return {
      status: "prepared",
      message:
        "Task prepared in the provider tab. If Send stays unavailable, check the attachment or send manually, then Continue.",
    };
  const baseline = assistants().length;
  send.click();
  return {
    status: "sent",
    baseline,
    message: "Task sent. Waiting for the response.",
  };
}
export async function agentRequest(m, api = chrome) {
  if (m.operation === "create") {
    for (const [id, old] of jobs)
      if (Date.now() - old.createdAt > 15 * 60 * 1000) jobs.delete(id);
    if (
      [...jobs.values()].filter(
        (j) => !["complete", "cancelled"].includes(j.status),
      ).length >= 3
    )
      throw new Error("Stop an existing browser task before starting another.");
    const input = validateAgentTask(m);
    const tab = await api.tabs.create({
      url: providers[input.provider],
      active: true,
    });
    const job = {
      ...input,
      fileName: input.file?.name || "",
      id: crypto.randomUUID(),
      tabId: tab.id,
      status: "opening",
      phase: input.file ? "attach" : "send",
      createdAt: Date.now(),
      message: "Opening your provider in a new tab.",
      baseline: 0,
      stable: 0,
    };
    jobs.set(job.id, job);
    return view(job);
  }
  const job = jobs.get(m.jobId);
  if (!job) throw new Error("This task is no longer active. Start a new task.");
  if (m.operation === "cancel") {
    job.status = "cancelled";
    job.file = null;
    job.prompt = "";
    job.message =
      "Stopped monitoring. A message already sent stays with the provider.";
    return view(job);
  }
  if (m.operation === "read") {
    job.phase = "read";
    job.status = "waiting";
    job.file = null;
    job.prompt = "";
  }
  if (!["status", "continue", "read"].includes(m.operation))
    throw new Error("Unknown agent operation.");
  if (["complete", "cancelled"].includes(job.status)) return view(job);
  if (Date.now() - job.createdAt > 15 * 60 * 1000) {
    job.status = "attention";
    job.message =
      "Monitoring timed out. Check the provider tab for your result.";
    job.file = null;
    return view(job);
  }
  if (job.status === "attention" && m.operation !== "continue")
    return view(job);
  if (job.busy) return view(job);
  job.busy = true;
  try {
    const tab = await api.tabs.get(job.tabId);
    if (
      !tab.url ||
      tab.url === "about:blank" ||
      tab.status === "loading" ||
      (job.readyAt && Date.now() < job.readyAt)
    )
      return view(job);
    if (new URL(tab.url).origin !== new URL(providers[job.provider]).origin)
      throw new Error(
        "The task tab left the selected provider. Return to its tab to continue.",
      );
    if (tab.status === "loading" || (job.readyAt && Date.now() < job.readyAt))
      return view(job);
    // Once submitted, monitoring can never submit a second time.
    job.pendingDispatch = job.phase === "send";
    const [{ result: r }] = await api.scripting.executeScript({
      target: { tabId: job.tabId },
      func: providerStep,
      args: [
        {
          phase: job.phase,
          provider: job.provider,
          prompt: job.prompt,
          file: job.file,
          baseline: job.baseline,
          fileName: job.fileName,
        },
      ],
    });
    job.pendingDispatch = false;
    if (
      r.status === "attention" &&
      /Sign in or finish/.test(r.message) &&
      Date.now() - job.createdAt < 15000
    ) {
      job.status = "opening";
      job.message = "Waiting for the provider workspace to load.";
      return view(job);
    }
    job.message = r.message;
    job.status = r.status;
    if (r.status === "attached") {
      job.phase = "send";
      job.readyAt = Date.now() + 4000;
      job.file = null;
    }
    if (r.status === "sent") {
      job.phase = "read";
      job.baseline = r.baseline;
      job.prompt = "";
    }
    if (r.status === "prepared") {
      job.status = "attention";
      job.message =
        "If you sent the task manually, use Read response to monitor it; otherwise send it in the provider tab.";
    }
    if (r.text) {
      job.stable = r.text === job.text && !r.streaming ? job.stable + 1 : 0;
      job.text = r.text;
      if (job.stable >= 3) {
        job.status = "complete";
        job.message = "Response captured. Review it before use.";
      }
    }
  } catch (error) {
    job.status = "attention";
    if (job.pendingDispatch) {
      job.phase = "read";
      job.pendingDispatch = false;
      job.message =
        "Submission could not be confirmed. Check the provider tab. Continue will only read the response; it will not resend your task.";
    } else job.message = error.message;
  } finally {
    job.busy = false;
  }
  return view(job);
}
function view(j) {
  return {
    id: j.id,
    tabId: j.tabId,
    status: j.status,
    message: j.message,
    text: j.text || "",
    provider: j.provider,
  };
}
