import { Store } from "./db.js";
import { createService } from "./service.js";
import { defaults } from "./core.js";
export const studioMode = new URLSearchParams(location.search).has("studio");
let service;
const readLocal = () => {
  try {
    return (
      JSON.parse(localStorage.getItem("ytmind-studio-settings") || "{}") || {}
    );
  } catch {
    return {};
  }
};
export function localService() {
  if (!service)
    service = createService({
      store: new Store("ytmind-studio"),
      readSettings: async () => ({ ...defaults, ...readLocal() }),
      writeSettings: async (value) =>
        localStorage.setItem("ytmind-studio-settings", JSON.stringify(value)),
      emit: (message) =>
        window.dispatchEvent(
          new CustomEvent("ytmind-local", { detail: message }),
        ),
    });
  return service;
}
export function sourceId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Enter a valid YouTube URL.");
  }
  if (!["https:", "http:"].includes(parsed.protocol))
    throw new Error("Enter an HTTP YouTube URL.");
  const id =
    parsed.hostname === "youtu.be"
      ? parsed.pathname.slice(1)
      : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
            parsed.hostname,
          )
        ? parsed.searchParams.get("v")
        : null;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id))
    throw new Error("Enter a YouTube watch URL or youtu.be link.");
  return id;
}
export async function fileFrame(file) {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024)
    throw new Error("Choose an image under 15 MB.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(1600, bitmap.width);
  canvas.height = Math.round((canvas.width * bitmap.height) / bitmap.width);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.65);
}
