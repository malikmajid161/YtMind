export function installBrowserAgent({ api, currentURL, refreshPage }) {
  const dialog = document.createElement("dialog");
  dialog.id = "browser-agent-dialog";
  dialog.innerHTML = `<form method="dialog" class="agent-title"><div><span class="eyebrow">BROWSER TASKS</span><h2>What would you like done?</h2></div><button class="icon-button" aria-label="Close browser agent">&times;</button></form>
 <p>Send a task and document to your signed-in Claude or ChatGPT tab, or collect information from public websites.</p>
 <label for="agent-mode">Task destination</label><select id="agent-mode"><option value="claude">Claude - use my Chrome session</option><option value="chatgpt">ChatGPT - use my Chrome session</option><option value="collect">Collect webpage information</option><option value="links">Collect webpage links</option><option value="tables">Collect webpage tables</option><option value="html">Collect cleaned webpage HTML</option></select>
 <div id="agent-messages" class="agent-messages" aria-live="polite"><p>For example: Use the attached lecture to draft an assignment with an introduction, clear sections and a conclusion.</p></div>
 <form id="agent-task-form"><label for="agent-prompt">Your task</label><textarea id="agent-prompt" maxlength="20000" rows="5" required placeholder="Describe your task. For collection, include website links."></textarea>
 <label for="agent-file">Attach a document (optional)</label><input id="agent-file" type="file" accept=".pdf,.docx,.txt,.md,.csv"><small>Up to 8 MB. Attachments go only to the provider you select when you click Run. Website collection does not use attachments.</small>
 <div class="toolbar"><button class="primary" id="agent-run" type="submit">Run task</button><button class="secondary" type="button" id="agent-refresh">Refresh page capture</button></div></form>
 <p id="agent-status" role="status"></p><div class="toolbar"><button class="secondary" id="agent-continue" hidden>Continue after sign-in</button><button class="secondary" id="agent-read" hidden>Read response after manual send</button><button class="secondary" id="agent-stop" hidden>Stop monitoring</button><button class="secondary" id="agent-export" hidden>Export report</button><button class="secondary" id="agent-export-json" hidden>Export JSON / HTML</button></div>
 <p class="muted">Keep YTMind open until the task finishes. Your browser keeps your sign-in. YTMind does not collect passwords or cookies. Provider websites may require login, upload confirmation or a security check. Site layouts can change.</p>`;
  document.body.append(dialog);
  const $ = (s) => dialog.querySelector(s);
  let task = null,
    timer = null,
    result = "",
    running = false,
    requesting = false;
  function message(text, role = "assistant") {
    const article = document.createElement("article");
    article.className = "agent-message";
    const label = document.createElement("strong");
    label.textContent = role === "user" ? "You" : "YTMind";
    const body = document.createElement("p");
    body.textContent = text;
    article.append(label, body);
    $("#agent-messages").append(article);
  }
  function show(job) {
    task = { ...task, ...job };
    if (task.steps?.at(-1)?.message !== (job.message || job.status))
      (task.steps ||= []).push({
        at: new Date().toISOString(),
        message: job.message || job.status,
      });
    $("#agent-status").textContent = job.message || job.status;
    $("#agent-continue").hidden = job.status !== "attention";
    $("#agent-read").hidden =
      job.status !== "attention" || task.kind !== "provider";
    if (job.text) result = job.text;
    if (job.results) result = JSON.stringify(job.results, null, 2);
    $("#agent-export").hidden = !result;
    $("#agent-export-json").hidden = !result;
    if (["complete", "failed", "cancelled"].includes(job.status)) {
      clearTimeout(timer);
      running = false;
      $("#agent-run").disabled = false;
      $("#agent-stop").hidden = true;
      if (result && !task.reported) {
        message(result);
        task.reported = true;
      }
    }
  }
  async function poll(operation = "status") {
    if (!task || requesting) return;
    requesting = true;
    try {
      show(
        await api(task.kind === "provider" ? "BROWSER_AGENT" : "BROWSER_TASK", {
          operation,
          jobId: task.id,
        }),
      );
    } catch (e) {
      $("#agent-status").textContent = e.message;
      running = false;
      $("#agent-run").disabled = false;
    } finally {
      requesting = false;
      clearTimeout(timer);
      if (running) timer = setTimeout(() => poll(), 2500);
    }
  }
  document
    .querySelector("#browser-agent-open")
    .addEventListener("click", () => {
      document.querySelector(".workspace-menu")?.removeAttribute("open");
      dialog.showModal();
    });
  document.querySelector("#web-scraper-open")?.addEventListener("click", () => {
    document.querySelector(".workspace-menu")?.removeAttribute("open");
    $("#agent-mode").value = "collect";
    $("#agent-prompt").placeholder =
      "Paste up to 10 public website links and describe what you want to collect.";
    dialog.showModal();
  });
  $("#agent-task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (running) return;
    const prompt = $("#agent-prompt").value.trim(),
      mode = $("#agent-mode").value,
      file = $("#agent-file").files[0];
    if (!prompt) return;
    $("#agent-run").disabled = true;
    try {
      const provider = ["claude", "chatgpt"].includes(mode);
      let attachment = null;
      if (file && !provider)
        throw new Error(
          "Attachments work with Claude and ChatGPT. Choose a provider for this task.",
        );
      if (file) {
        if (file.size > 8 * 1024 * 1024)
          throw new Error("Choose a document up to 8 MB.");
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () =>
            reject(new Error("The document could not be read."));
          reader.readAsDataURL(file);
        });
        attachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          data,
        };
      }
      message(prompt + (file ? `\nAttachment: ${file.name}` : ""), "user");
      result = "";
      $("#agent-export").hidden = true;
      const urls =
        prompt.match(/https?:\/\/[^\s<>"']+/g) ||
        [currentURL()].filter(Boolean);
      const response = await api(
        provider ? "BROWSER_AGENT" : "BROWSER_TASK",
        provider
          ? { operation: "create", provider: mode, prompt, file: attachment }
          : {
              operation: "create",
              mode:
                mode === "collect" && /\bhtml\b/i.test(prompt) ? "html" : mode,
              urls,
            },
      );
      task = {
        ...response,
        kind: provider ? "provider" : "collection",
        request: { prompt, attachment: file?.name || null, mode },
        steps: [],
      };
      running = true;
      $("#agent-stop").hidden = false;
      $("#agent-status").textContent =
        response.message || "Starting browser collection...";
      await poll();
    } catch (err) {
      message(err.message);
      $("#agent-status").textContent = err.message;
      $("#agent-run").disabled = false;
    }
  });
  $("#agent-continue").onclick = () => poll("continue");
  $("#agent-read").onclick = () => poll("read");
  $("#agent-stop").onclick = () => poll("cancel");
  $("#agent-refresh").onclick = async () => {
    try {
      await refreshPage();
      message(
        "Visible page capture refreshed. Open or scroll to another section to capture more content.",
      );
    } catch (e) {
      message(e.message);
    }
  };
  $("#agent-export-json").onclick = () => {
    const html = task?.results?.length === 1 ? task.results[0].html : null;
    const blob = new Blob(
      [
        html ||
          JSON.stringify(
            {
              request: task?.request,
              steps: task?.steps,
              results: task?.results || [
                { provider: task?.provider, text: result },
              ],
            },
            null,
            2,
          ),
      ],
      { type: html ? "text/html" : "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = html ? "ytmind-page.html" : "ytmind-task.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("#agent-export").onclick = () => {
    const blob = new Blob(
        [
          `# Browser task report\n\n## Request\n\n${task?.request?.prompt || ""}\n\nAttachment: ${task?.request?.attachment || "None"}\n\n## Recorded steps\n\n${(task?.steps || []).map((s, i) => `${i + 1}. ${s.at} - ${s.message}`).join("\n")}\n\n## Result\n\n${result}`,
        ],
        {
          type: "text/markdown",
        },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "ytmind-browser-task.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
