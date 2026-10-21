import assert from "node:assert/strict";
export async function testStudio(browser, port = 4174) {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 900 },
  });
  try {
    await context.route("https://api.groq.com/**", async (route) => {
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "authorization,content-type",
      };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      if (route.request().url().endsWith("/models")) {
        await route.fulfill({
          json: {
            data: [{ id: "openai/gpt-oss-120b" }, { id: "openai/gpt-oss-20b" }],
          },
          headers,
        });
        return;
      }
      if (route.request().url().endsWith("/audio/transcriptions")) {
        await route.fulfill({
          json: {
            segments: [
              { text: "Run npm install.", start: 2, no_speech_prob: 0.01 },
            ],
          },
          headers,
        });
        return;
      }
      const body = route.request().postDataJSON(),
        system = body.messages[0].content;
      let content;
      if (system.startsWith("Analyze captured video evidence"))
        content = JSON.stringify({ findings: [], moreFindings: false });
      else if (system.startsWith("Extract only programming")) {
        const source = body.messages[1].content;
        const ref = Number(
          source.match(/\[E(\d+)\][^\[]*const count = 123;/)?.[1],
        );
        content = JSON.stringify({
          snippets: ref
            ? [{ language: "javascript", code: "const count = 123;", ref }]
            : [],
        });
      } else if (system.startsWith("Extract concepts"))
        content = JSON.stringify({
          nodes: [
            { label: "Node.js", type: "technology", refs: [1] },
            { label: "npm", type: "tool", refs: [1] },
          ],
          edges: [
            { source: "Node.js", target: "npm", relation: "uses", refs: [1] },
          ],
        });
      else if (system.startsWith("Compare nearby"))
        content = JSON.stringify({
          observations: [
            {
              status: "potential_mismatch",
              description: "The source versions differ.",
              caption: { ref: 1, quote: "Node.js 18" },
              frame: { ref: 2, quote: "Node.js 22" },
            },
          ],
        });
      else if (system.startsWith("Create a tutorial preflight"))
        content = JSON.stringify({
          steps: [
            {
              action: "Install dependencies",
              support: { ref: 1, quote: "Run npm install." },
              commands: [{ ref: 1, quote: "npm install" }],
              prerequisites: [],
              warnings: [],
            },
          ],
          questions: [],
        });
      else if (body.response_format)
        content = JSON.stringify({
          status: "supported",
          reason: "Controlled integration test only.",
          claims: [
            { text: "Run npm install.", verdict: "supported", refs: [1] },
          ],
        });
      else
        content =
          "## Summary\nRun npm install. [E1]\n\n## Key Concepts\nNode.js is the tutorial runtime. [E1]";
      await route.fulfill({
        json: { choices: [{ message: { content } }] },
        headers,
      });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/panel.html?studio`);
    await page.locator("#settings-dialog").waitFor({ state: "visible" });
    await page.locator("#api-key").fill("controlled-test-key");
    await page.locator("#auto-code").uncheck();
    await page.locator("#check-connection").click();
    await page
      .getByText("Connected · 2 chat models available.", { exact: false })
      .waitFor();
    await page.locator("#settings-form .primary").click();
    await page
      .locator("#source-url")
      .fill("https://www.youtube.com/watch?v=abcdefghijk");
    await page.locator("#source-title").fill("Controlled tutorial workspace");
    await page.locator("#link-auto-ingest").uncheck();
    await page.locator("#source-form .primary").click();
    await page
      .getByText("Controlled tutorial workspace", { exact: true })
      .waitFor();
    await page.locator('[data-generate="notes"]').click();
    await page
      .getByText("No readable source text is available yet.", { exact: false })
      .waitFor();
    await page.locator('[data-tab="chat"]').click();
    await page.waitForFunction(() => document.querySelector("#notice").hidden);
    await page.locator('[data-tab="notes"]').click();
    await page
      .getByText("Missing captions? Add your own source", { exact: true })
      .click();
    await page
      .locator("#manual-source")
      .fill("For this tutorial install Node.js 18. Run npm install.");
    await page.getByRole("button", { name: "Use this transcript" }).click();
    await page.locator('[data-generate="notes"]').click();
    await page.locator(".result").waitFor();
    assert.ok(
      (await page.locator(".result").textContent()).includes("npm install"),
    );
    await page.locator('[data-generate="notes"]:enabled').waitFor();
    await page.locator('[data-tab="library"]').click();
    assert.equal(await page.locator(".library-card").count(), 1);
    await page.locator("details[data-history-id] summary").click();
    await page.locator(".history-outputs .result").waitFor();
    assert.ok(
      (await page.locator(".history-outputs").textContent()).includes(
        "npm install",
      ),
    );
    await page.locator('[data-tab="notes"]').click();
    await page.locator("#pin").click();
    await page.locator('[data-tab="actions"]').click();
    await page.locator('[data-generate="actions"]').click();
    await page.locator(".result").waitFor();
    await page.locator('[data-tab="chat"]').click();
    await page.locator("#question").pressSequentially("Explain");
    await page.evaluate(async () => {
      window.fixtureQuestionNode = document.querySelector("#question");
      await new Promise((resolve, reject) => {
        const open = indexedDB.open("ytmind-studio");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("sessions", "readwrite");
          const store = tx.objectStore("sessions");
          const request = store.get(
            localStorage.getItem("ytmind-studio-active"),
          );
          request.onsuccess = () =>
            store.put({ ...request.result, pinned: false });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
      window.dispatchEvent(
        new CustomEvent("ytmind-local", {
          detail: { type: "FRAME_AVAILABLE" },
        }),
      );
    });
    await page.waitForFunction(
      () => document.querySelector("#pin").textContent === "◇",
    );
    assert.equal(await page.locator("#question").inputValue(), "Explain");
    assert.equal(
      await page.evaluate(
        () =>
          document.activeElement === window.fixtureQuestionNode &&
          document.querySelector("#question") === window.fixtureQuestionNode,
      ),
      true,
    );
    await page
      .locator("#question")
      .pressSequentially(" the installation steps");
    assert.equal(
      await page.locator("#question").inputValue(),
      "Explain the installation steps",
    );
    await page.locator('[data-tab="notes"]').click();
    await page.locator('[data-tab="chat"]').click();
    assert.equal(
      await page.locator("#question").inputValue(),
      "Explain the installation steps",
    );
    await page.locator("#pin").click();
    await page.setViewportSize({ width: 320, height: 700 });
    await page.locator("#question").fill("npm install");
    await page.waitForFunction(() => {
      const rect = document
        .querySelector("#send-question")
        .getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.bottom <= innerHeight &&
        rect.left >= 0 &&
        rect.right <= innerWidth
      );
    });
    await page.locator("#question").press("Control+Enter");
    await page.locator(".result").waitFor();
    await page.locator("#question").fill("What prerequisites are mentioned?");
    await page
      .getByRole("button", { name: "Send question", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("#workspace .question").length === 2,
    );
    await page.setViewportSize({ width: 1100, height: 900 });
    await context.addInitScript(() => {
      window.print = () => {
        window.fixturePrintCalls = (window.fixturePrintCalls || 0) + 1;
      };
    });
    const exportTab = context.waitForEvent("page");
    await page.locator("[data-pdf]").first().click();
    const pdfPage = await exportTab;
    await pdfPage.waitForFunction(() => window.fixturePrintCalls > 0);
    assert.match(
      await pdfPage.locator("#document").textContent(),
      /Source references/,
    );
    assert.equal(
      await pdfPage.locator(".source a").first().getAttribute("href"),
      "https://www.youtube.com/watch?v=abcdefghijk&t=0s",
    );
    await pdfPage.pdf({
      path: "artifacts/print-view-export.pdf",
      format: "A4",
      printBackground: true,
    });
    await pdfPage.screenshot({
      path: "artifacts/print-view-export.png",
      fullPage: true,
    });
    await pdfPage.close();
    await page.locator('[data-tab="graph"]').click();
    await page.locator("#extract-graph").click();
    await page.locator(".graph-canvas").waitFor();
    assert.equal(await page.locator("[data-node]").count(), 2);
    await page.locator('[data-tab="vera"]').click();
    const image = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1100;
      c.height = 180;
      const x = c.getContext("2d");
      x.fillStyle = "white";
      x.fillRect(0, 0, 1100, 180);
      x.fillStyle = "black";
      x.font = "48px Arial";
      x.fillText("Required runtime Node.js 22", 24, 100);
      return c.toDataURL().split(",")[1];
    });
    await page.locator("#frame-time").fill("12");
    await page.locator("#frame-files").setInputFiles({
      name: "slide.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector(".frame-body p")
          ?.textContent.includes("Node.js 22"),
      null,
      { timeout: 30000 },
    );
    await page.locator('[data-tab="lab"]').click();
    await page.locator("#full-source-timeline > summary").click();
    await page.locator("#moment-list .source-proof").first().waitFor();
    assert.ok((await page.locator("#moment-list .source-proof").count()) > 0);
    await page
      .locator("#moment-search")
      .fill("phrase-that-is-not-present-anywhere");
    assert.equal(await page.locator("#moment-list .source-proof").count(), 0);
    await page.locator("#moment-search").fill("");
    await page.locator("#moment-list .source-proof").first().waitFor();
    assert.ok((await page.locator("#moment-list .source-proof").count()) > 0);
    await page.locator("#full-source-timeline > summary").click();
    await page.locator('[data-lab="conflicts"]').click();
    await page
      .getByText("The source versions differ.", { exact: false })
      .waitFor();
    await page.locator('[data-lab="preflight"]').click();
    await page.getByText("Tutorial preflight", { exact: true }).waitFor();
    await page.locator('[data-generate="talkshow"]').click();
    await page.getByText("VIDEO ANALYSIS", { exact: true }).waitFor();
    await page
      .getByText(
        "The model returned no grounded content from this captured section.",
        {
          exact: false,
        },
      )
      .waitFor();
    await page.reload();
    await page.locator('[data-tab="lab"]').click();
    await page.getByText("VIDEO ANALYSIS", { exact: true }).waitFor();
    await page.locator('[data-tab="library"]').click();
    await page.locator("#research-topic").fill("Node.js");
    await page.locator("#research-form .primary").click();
    await page.locator(".result").waitFor();
    await page.reload();
    await page.locator('[data-tab="notes"]').click();
    await page.locator(".result").waitFor();
    assert.ok(
      (await page.locator(".result").textContent()).includes("npm install"),
    );
    await page.screenshot({
      path: "artifacts/working-studio.png",
      fullPage: true,
    });
    await page
      .getByText("Missing captions? Add your own source", { exact: true })
      .click();
    await page.locator("#subtitle-file").setInputFiles({
      name: "source.vtt",
      mimeType: "text/vtt",
      buffer: Buffer.from(
        "WEBVTT\n\n00:12.500 --> 00:15.000\nRun npm install.",
      ),
    });
    await page.locator("#source-dialog").waitFor({ state: "visible" });
    await page.locator("#save-reviewed-source").click();
    await page.waitForFunction(async () => {
      const request = indexedDB.open("ytmind-studio");
      const db = await new Promise(
        (resolve) => (request.onsuccess = () => resolve(request.result)),
      );
      const r = db
        .transaction("sessions")
        .objectStore("sessions")
        .get("abcdefghijk");
      return await new Promise(
        (resolve) =>
          (r.onsuccess = () =>
            resolve(r.result.transcript[0].startTime === 12.5)),
      );
    });
    await page
      .getByText("Missing captions? Add your own source", { exact: true })
      .click();
    await page.locator("#audio-file").setInputFiles({
      name: "speech.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from("controlled audio fixture"),
    });
    await page.locator("#audio-offset").fill("30");
    await page.locator("#transcribe-audio").click();
    await page.waitForFunction(
      () => !document.querySelector("#save-reviewed-source").disabled,
    );
    assert.ok(
      (await page.locator("#review-source").inputValue()).includes(
        '"startTime": 32',
      ),
    );
    await page.locator("#save-reviewed-source").click();
    await page.locator("#source-dialog").waitFor({ state: "hidden" });
    await page.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const destination = audio.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const video = canvas.captureStream(10);
        window.fixtureAudio = audio;
        window.fixtureTracks = [
          ...destination.stream.getTracks(),
          ...video.getTracks(),
        ];
        return new MediaStream(window.fixtureTracks);
      };
    });
    await page
      .getByText("Missing captions? Add your own source", { exact: true })
      .click();
    await page.locator("#record-tab-audio").click();
    await page.locator("#stop-recording").waitFor({ state: "visible" });
    await page.waitForTimeout(1100);
    await page.locator("#stop-recording").click();
    await page.locator("#transcribe-audio").waitFor({ state: "visible" });
    assert.equal(
      await page.evaluate(() =>
        window.fixtureTracks.every((t) => t.readyState === "ended"),
      ),
      true,
    );
    await page.locator("#source-dialog-close").click();
    await page.evaluate(() => window.fixtureAudio.close());
    await page.locator('[data-tab="library"]').click();
    await page.locator("#batch-start").click();
    await page.waitForFunction(() =>
      document.querySelector(".batch-card")?.textContent.includes("complete"),
    );
    const zipReady = page.waitForEvent("download");
    await page.locator("#batch-export").click();
    assert.equal(
      (await zipReady).suggestedFilename(),
      "ytmind-lecture-notes.zip",
    );
    await page.locator('[data-tab="vera"]').click();
    const codeImage = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 160;
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, 1000, 160);
      context.fillStyle = "black";
      context.font = "48px monospace";
      context.fillText("const count = 123;", 20, 100);
      return canvas.toDataURL().split(",")[1];
    });
    await page.locator("#frame-files").setInputFiles({
      name: "code.png",
      mimeType: "image/png",
      buffer: Buffer.from(codeImage, "base64"),
    });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".frame-body p")].some((e) =>
          e.textContent.includes("const count = 123;"),
        ),
      null,
      { timeout: 30000 },
    );
    await page.locator("#extract-code").click();
    await page.locator("[data-code-zip]").waitFor();
    const codeZip = page.waitForEvent("download");
    await page.locator("[data-code-zip]").click();
    assert.equal((await codeZip).suggestedFilename(), "ytmind-source-code.zip");
    assert.deepEqual(errors, []);
    console.log(
      "Local app integration passed: settings/models, source import, notes/actions/Q&A, graph, real OCR upload, lab/preflight, pinned research and reload persistence. API responses mocked; storage/OCR/browser pipeline real.",
    );
  } finally {
    await context.close();
  }
}
