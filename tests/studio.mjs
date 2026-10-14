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
      const body = route.request().postDataJSON(),
        system = body.messages[0].content;
      let content;
      if (system.startsWith("Extract concepts"))
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
    await page.locator("#check-connection").click();
    await page
      .getByText("Connected · 2 chat models available.", { exact: false })
      .waitFor();
    await page.locator("#settings-form .primary").click();
    await page
      .locator("#source-url")
      .fill("https://www.youtube.com/watch?v=abcdefghijk");
    await page.locator("#source-title").fill("Controlled tutorial workspace");
    await page.locator("#source-form .primary").click();
    await page
      .getByText("Controlled tutorial workspace", { exact: true })
      .waitFor();
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
    await page.locator("#pin").click();
    await page.locator('[data-tab="actions"]').click();
    await page.locator('[data-generate="actions"]').click();
    await page.locator(".result").waitFor();
    await page.locator('[data-tab="chat"]').click();
    await page.locator("#question").fill("npm install");
    await page.locator("#ask-form .primary").click();
    await page.locator(".result").waitFor();
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
    await page.locator('[data-lab="conflicts"]').click();
    await page
      .getByText("The source versions differ.", { exact: false })
      .waitFor();
    await page.locator('[data-lab="preflight"]').click();
    await page.getByText("Tutorial preflight", { exact: true }).waitFor();
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
    assert.deepEqual(errors, []);
    console.log(
      "Local app integration passed: settings/models, source import, notes/actions/Q&A, graph, real OCR upload, lab/preflight, pinned research and reload persistence. API responses mocked; storage/OCR/browser pipeline real.",
    );
  } finally {
    await context.close();
  }
}
