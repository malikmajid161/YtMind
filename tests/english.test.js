import test from "node:test";
import assert from "node:assert/strict";
import { needsEnglish, ensureEnglish } from "../src/english.js";

test("English prose with Hindi quotes is translated while evidence markers remain", async () => {
  const original = "Bring devices: जाओ लैपटॉप लेकर आओ. [E2]";
  assert.equal(needsEnglish(original), true);
  const translated = await ensureEnglish(
    {},
    original,
    async (_, system, user) => {
      assert.match(system, /exact \[E1\]/);
      assert.equal(user, original);
      return "Bring a laptop. [E2]";
    },
  );
  assert.equal(translated, "Bring a laptop. [E2]");
});

test("English output makes no extra API call and code strings are preserved", async () => {
  const text = 'An example:\n```js\nconst label = "کتاب";\n```';
  assert.equal(needsEnglish(text), false);
  assert.equal(
    await ensureEnglish({}, text, () => {
      throw new Error("Unexpected call");
    }),
    text,
  );
});

test("failed English rewrite cannot silently save Hindi prose", async () => {
  await assert.rejects(
    ensureEnglish({}, "यह पाठ", async () => "यह पाठ"),
    /untranslated text/,
  );
});
