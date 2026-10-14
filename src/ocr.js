import { createWorker } from "tesseract.js";
const workers = [];
const asset = (path) =>
  globalThis.chrome?.runtime?.getURL
    ? chrome.runtime.getURL(path)
    : new URL(path, location.href).href;
export async function recognize(image, slot = 0) {
  if (!workers[slot])
    workers[slot] = createWorker("eng", 1, {
      workerPath: asset("ocr/worker.min.js"),
      corePath: asset("ocr/"),
      langPath: asset("ocr/"),
      workerBlobURL: false,
      gzip: true,
    }).catch((e) => {
      workers[slot] = null;
      throw e;
    });
  const worker = await workers[slot];
  const { data } = await worker.recognize(image);
  return { text: data.text, confidence: data.confidence };
}
