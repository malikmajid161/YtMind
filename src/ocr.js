import { createWorker } from "tesseract.js";
import { simd } from "wasm-feature-detect";
const coreFile = simd().then((supported) =>
  supported ? "ocr/tesseract-core-simd-lstm.js" : "ocr/tesseract-core-lstm.js",
);
const workers = [];
const asset = (path) =>
  globalThis.chrome?.runtime?.getURL
    ? chrome.runtime.getURL(path)
    : new URL(path, location.href).href;
export async function recognize(image, slot = 0, language = "eng") {
  if (!["eng", "urd", "eng+urd"].includes(language))
    throw new Error("Unsupported OCR language.");
  const decoded = new Image();
  decoded.src = image;
  await decoded.decode();
  if (decoded.naturalWidth < 3 || decoded.naturalHeight < 3)
    return { text: "", confidence: 0, reason: "image-too-small" };
  const corePath = asset(await coreFile);
  if (workers[slot]?.language !== language) {
    if (workers[slot]) await (await workers[slot].promise).terminate();
    const entry = { language, promise: null };
    entry.promise = createWorker(language, 1, {
      workerPath: asset("ocr/worker.min.js"),
      corePath,
      langPath: asset("ocr/"),
      workerBlobURL: false,
      gzip: true,
    }).catch((e) => {
      if (workers[slot] === entry) workers[slot] = null;
      throw e;
    });
    workers[slot] = entry;
  }
  const worker = await workers[slot].promise;
  const { data } = await worker.recognize(image);
  return { text: data.text, confidence: data.confidence };
}
