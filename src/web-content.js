import { isChallengePage, pageIdentity } from "./page-details.js";
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
    const identity = pageIdentity(document, originalURL);
    if (text.length < 20 || isChallengePage(identity.originalTitle, text))
      return;
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    await chrome.runtime.sendMessage({
      type: "PAGE_CAPTURE",
      url: originalURL,
      ...identity,
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
let scheduled;
function scheduleCapture() {
  // Throttle rather than continually resetting a debounce: a live feed or
  // animation must not postpone capture indefinitely.
  if (scheduled) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    capturePage();
  }, 900);
}
window.addEventListener("scroll", scheduleCapture, {
  passive: true,
  signal: lifetime.signal,
});
document.addEventListener(
  "click",
  (event) => {
    if (
      !event.isTrusted ||
      !extensionAvailable() ||
      document.hidden ||
      !readingURL(location.href)
    )
      return;
    const element = event.target.closest?.(
      'a,button,[role="button"],[role="tab"]',
    );
    if (
      !element ||
      element.closest('form,[contenteditable],input,textarea,[role="textbox"]')
    )
      return;
    const label = (
      element.getAttribute("aria-label") ||
      element.innerText ||
      element.getAttribute("title") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    if (!label) return;
    chrome.runtime
      .sendMessage({
        type: "PAGE_EVENT",
        url: location.href,
        visitToken,
        event: {
          kind: element.matches("a") ? "link" : "click",
          label,
          targetURL: readingURL(element.href) || "",
        },
      })
      .catch(() => {});
    scheduleCapture();
  },
  { capture: true, signal: lifetime.signal },
);
document.addEventListener("toggle", scheduleCapture, {
  capture: true,
  signal: lifetime.signal,
});
window.addEventListener("popstate", scheduleCapture, {
  signal: lifetime.signal,
});
window.addEventListener("pageshow", scheduleCapture, {
  signal: lifetime.signal,
});
const changes = new MutationObserver(scheduleCapture);
if (document.body)
  changes.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
lifetime.signal.addEventListener("abort", () => {
  clearTimeout(scheduled);
  changes.disconnect();
});
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

const handleReadingMessage = (message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== "READ_PAGE_NOW")
    return;
  capturePage().then(
    () => respond({ ok: true }),
    () => respond({ error: "Page text is unavailable." }),
  );
  return true;
};
chrome.runtime.onMessage.addListener(handleReadingMessage);
lifetime.signal.addEventListener("abort", () => {
  try {
    chrome.runtime.onMessage.removeListener(handleReadingMessage);
  } catch {}
});
