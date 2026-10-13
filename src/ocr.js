import { createWorker } from "tesseract.js";
const workers = [];
export async function recognize(image, slot = 0) {
  if (!workers[slot])
    workers[slot] = createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL("ocr/worker.min.js"),
      corePath: chrome.runtime.getURL("ocr/"),
      langPath: chrome.runtime.getURL("ocr/"),
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
