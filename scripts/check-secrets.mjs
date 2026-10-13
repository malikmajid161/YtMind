import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const files = execFileSync("git", ["ls-files", "--cached", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const found = [];
for (const file of files) {
  try {
    const data = await readFile(file, "utf8");
    if (/gsk_[A-Za-z0-9]{30,}/.test(data)) found.push(file);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
if (found.length) {
  console.error(
    "Credential-like strings found in tracked files: " + found.join(", "),
  );
  process.exit(1);
}
console.log("Tracked-file credential check passed. No Groq keys detected.");
