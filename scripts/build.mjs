import { build } from "esbuild";
import { cp, mkdir, rm, readdir } from "node:fs/promises";
import path from "node:path";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/ocr", { recursive: true });
await cp("public", "dist", { recursive: true });
await build({
  entryPoints: [
    "src/background.js",
    "src/content.js",
    "src/panel.js",
    "src/ocr.js",
  ],
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "chrome116",
  sourcemap: true,
});
await cp(
  "node_modules/tesseract.js/dist/worker.min.js",
  "dist/ocr/worker.min.js",
);
for (const file of await readdir("node_modules/tesseract.js-core")) {
  if (/\.wasm(?:\.js)?$/.test(file))
    await cp(
      path.join("node_modules/tesseract.js-core", file),
      path.join("dist/ocr", file),
    );
}
await cp(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  "dist/ocr/eng.traineddata.gz",
);
console.log("Built unpacked extension in dist/ (OCR assets included).");
