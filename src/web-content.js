import { readingURL, extractReadingText } from "./web-history.js";
import { extensionAvailable } from "./extension-context.js";

globalThis.ytmindReadingLifetime?.abort();
const lifetime = new AbortController();
globalThis.ytmindReadingLifetime = lifetime;
const visitToken = crypto.randomUUID();
let busy = false;
async function capturePage() {
  if (!extensionAvailable()) {
    lifetime.abort();
    return;
  }
  if (busy || document.hidden || !readingURL(location.href)) return;
  busy = true;
  const originalURL = location.href;
  try {
    const reply = await chrome.runtime.sendMessage({ type: "READING_STATUS" });
    if (
      !reply?.data?.enabled ||
      document.hidden ||
      location.href !== originalURL
    )
      return;
    const text = extractReadingText(document);
    // An empty article must not turn a private/form page into a stored title.
    if (text.length < 80) return;
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    await chrome.runtime.sendMessage({
      type: "PAGE_CAPTURE",
      url: originalURL,
      title: document.title,
      text,
      visitToken,
      progress:
        scrollable > 0
          ? Math.min(100, Math.round((scrollY / scrollable) * 100))
          : 100,
    });
  } catch {
    if (!extensionAvailable()) lifetime.abort();
  } finally {
    busy = false;
  }
}
const timer = setInterval(capturePage, 10000);
const first = setTimeout(capturePage, 2500);
document.addEventListener(
  "visibilitychange",
  () => {
    if (!document.hidden) capturePage();
  },
  { signal: lifetime.signal },
);
lifetime.signal.addEventListener("abort", () => {
  clearInterval(timer);
  clearTimeout(first);
});
