import test from "node:test";
import assert from "node:assert/strict";
import { assessOCR } from "../src/ocr-quality.js";
test("readable caption line is retained while low-confidence image fragments remain raw-only", () => {
  const caption = "Forehead be mine, doorstep be yours, O Allah's Prophet";
  const result = assessOCR({
    text: "HEIN MAF non§ 2 fF\n" + caption,
    confidence: 39,
    blocks: [
      {
        paragraphs: [
          {
            lines: [
              { text: "HEIN MAF non§ 2 fF", confidence: 20 },
              { text: caption, confidence: 94 },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(result.text, caption);
  assert.equal(result.overallConfidence, 39);
  assert.equal(result.confidence, 94);
  assert.equal(result.uncertainLines.length, 1);
  assert.match(result.rawText, /HEIN MAF/);
});
test("accepted OCR preserves code whitespace and never rewrites uncertain words", () => {
  assert.equal(
    assessOCR({ text: "    const count = 123;", confidence: 90 }).text,
    "    const count = 123;",
  );
  const weak = assessOCR({ text: "garbled words", confidence: 39 });
  assert.equal(weak.text, "");
  assert.equal(weak.rawText, "garbled words");
});
