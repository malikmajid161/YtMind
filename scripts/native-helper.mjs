import { readFile } from "node:fs/promises";
import { previewServer } from "./preview.mjs";
const extensionId =
  process.env.YTMIND_EXTENSION_ID ||
  (await readFile("artifacts/extension-id.txt", "utf8").catch(() => "")).trim();
if (!/^[a-p]{32}$/.test(extensionId))
  throw new Error(
    "Set YTMIND_EXTENSION_ID to the extension ID from chrome://extensions.",
  );
process.env.YTMIND_EXTENSION_ID = extensionId;
await previewServer(4175);
console.log(
  "YTMind local audio helper ready at http://127.0.0.1:4175 (paired extension only).",
);
