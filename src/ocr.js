import { createWorker } from "tesseract.js";
const workers = [];
const asset = (path) =>
  globalThis.chrome?.runtime?.getURL
    ? chrome.runtime.getURL(path)
    : new URL(path, location.href).href;
export async function recognize(image, slot = 0, language = "eng") {
  if (!["eng", "urd", "eng+urd"].includes(language))
    throw new Error("Unsupported OCR language.");
  if (workers[slot]?.language !== language) {
    if (workers[slot]) await (await workers[slot].promise).terminate();
    const entry = { language, promise: null };
    entry.promise = createWorker(language, 1, {
      workerPath: asset("ocr/worker.min.js"),
      corePath: asset("ocr/"),
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
