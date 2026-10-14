import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { wrapBrowserCore } from "../scripts/ocr-loader.mjs";
test("only known skipped-line OCR messages are informational; aborts remain warnings", () => {
  const info = [],
    warnings = [];
  const context = vm.createContext({
    console: {
      info: (...args) => info.push(args),
      warn: (...args) => warnings.push(args),
    },
  });
  vm.runInContext(
    wrapBrowserCore("var TesseractCore = options => options;"),
    context,
  );
  const options = context.TesseractCore();
  options.printErr("Image too small to scale!! (1x36 vs min width of 3)");
  options.printErr("Line cannot be recognized!!");
  options.printErr("Aborted(memory allocation failed)");
  options.printErr("Unexpected OCR warning");
  assert.equal(info.length, 2);
  assert.deepEqual(
    warnings.map((args) => args[0]),
    ["Aborted(memory allocation failed)", "Unexpected OCR warning"],
  );
});
