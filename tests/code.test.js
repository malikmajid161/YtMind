import test from "node:test";
import assert from "node:assert/strict";
import { validateCode } from "../src/code.js";
test("code extraction rejects invented lines and retains exact whitespace and source identity", () => {
  const evidence = [
    {
      text: "def demo():\n    return 1",
      videoId: "abcdefghijk",
      startTime: 12,
      kind: "frame",
    },
  ];
  const result = validateCode(
    {
      snippets: [
        { language: "python", code: "def demo():\n    return 1", ref: 1 },
        { language: "python", code: "def demo():\nreturn 1", ref: 1 },
        { language: "python", code: "import os", ref: 1 },
      ],
    },
    evidence,
  );
  assert.equal(result.snippets.length, 1);
  assert.equal(result.rejected, 2);
  assert.equal(result.snippets[0].fileName, "snippet-1.py");
  assert.equal(result.snippets[0].source.startTime, 12);
});
