import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(
    '<html><title>Scraper fixture</title><main><h1 onclick="alert(1)" data-secret="PRIVATE_ATTRIBUTE">Course catalogue</h1><script>PRIVATE_SCRIPT</script><p>Public course description.</p><a href="https://example.com/course">Course details</a><table><tr><th>Course</th><th>Hours</th></tr><tr><td>Testing</td><td>12</td></tr></table><form><input value="PRIVATE_FORM_VALUE"></form></main></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const directory = path.resolve("artifacts/scraper-test");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, "request.json");
  await writeFile(
    file,
    JSON.stringify({
      mode: "collect",
      urls: [`http://127.0.0.1:${server.address().port}/`],
    }),
  );
  const output = await new Promise((resolve, reject) => {
    const child = spawn("python", ["scripts/browser-job.py", file], {
      env: { ...process.env, YTMIND_BROWSER_TEST: "1" },
      windowsHide: true,
    });
    let text = "",
      err = "";
    child.stdout.on("data", (d) => (text += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(text) : reject(new Error(err || text)),
    );
  });
  const items = output
    .trim()
    .split(/\r?\n/)
    .map((s) => JSON.parse(s));
  const result = items.find((x) => x.type === "page").result;
  assert.equal(result.status, "complete");
  assert.match(result.text, /Public course description/);
  assert.doesNotMatch(result.text, /PRIVATE_FORM_VALUE/);
  assert.equal(result.links[0].url, "https://example.com/course");
  assert.equal(result.tables[0][1][0], "Testing");
  console.log(
    "Real Selenium scraper passed: public text, links and tables collected; form values excluded; owned browser closed.",
  );
} finally {
  server.close();
}
