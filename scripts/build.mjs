import { build } from "esbuild";
import { cp, mkdir, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { wrapBrowserCore } from "./ocr-loader.mjs";
import path from "node:path";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/ocr", { recursive: true });
await cp("public", "dist", { recursive: true });
await build({
  entryPoints: [
    "src/background.js",
    "src/panel.js",
    "src/ocr.js",
    "src/offscreen.js",
    "src/print.js",
  ],
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "chrome116",
  sourcemap: true,
});
await build({
  entryPoints: ["src/content.js"],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome116",
  sourcemap: true,
});
await cp(
  "node_modules/tesseract.js/dist/worker.min.js",
  "dist/ocr/worker.min.js",
);
for (const file of await readdir("node_modules/tesseract.js-core")) {
  if (/^tesseract-core(?:-simd)?(?:-lstm)?\.(?:js|wasm)$/.test(file))
    if (file.endsWith(".js"))
      await writeFile(
        path.join("dist/ocr", file),
        wrapBrowserCore(
          await readFile(
            path.join("node_modules/tesseract.js-core", file),
            "utf8",
          ),
        ),
      );
    else
      await cp(
        path.join("node_modules/tesseract.js-core", file),
        path.join("dist/ocr", file),
      );
}
await cp(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  "dist/ocr/eng.traineddata.gz",
);

await cp(
  "node_modules/@tesseract.js-data/urd/4.0.0_best_int/urd.traineddata.gz",
  "dist/ocr/urd.traineddata.gz",
);

console.log(
  "Built unpacked extension in dist/ (English and Urdu OCR assets included).",
);
