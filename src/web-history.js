// Reading history stores page content, never form values or browser keystrokes.
export function readingURL(value) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    if (/^(?:localhost|127\.|\[::1\])/.test(url.hostname)) return null;
    if (
      /(?:^|\.)(?:youtube\.com|youtu\.be|mail\.google\.com|outlook\.(?:com|live\.com|office\.com)|proton\.me|slack\.com|discord\.com|web\.whatsapp\.com|web\.telegram\.org|messenger\.com|chatgpt\.com|claude\.ai|gemini\.google\.com|paypal\.com|stripe\.com)$/.test(
        url.hostname,
      )
    )
      return null;
    if (
      /bank|banking/.test(url.hostname) ||
      /\/(?:login|log-?in|sign-?in|sign-?up|auth|oauth|account|accounts|billing|checkout|payment|payments|inbox|messages|chat|settings|admin)(?:[/._-]|$)/i.test(
        url.pathname,
      )
    )
      return null;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function extractReadingText(doc) {
  if (
    doc.querySelector(
      'input[type="password"], input[autocomplete^="cc-"], [data-private="true"]',
    )
  )
    return "";
  const root =
    doc.body || doc.querySelector("main") || doc.querySelector("article");
  if (!root) return "";
  const walker = doc.createTreeWalker(root, 4);
  const pieces = [];
  let length = 0,
    count = 0;
  while (walker.nextNode() && count++ < 20000 && length < 40000) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (
      !parent ||
      parent.closest(
        'script,style,noscript,nav,header,footer,form,input,textarea,select,button,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"]',
      )
    )
      continue;
    const rects = parent.getClientRects();
    if (
      !rects.length ||
      ![...rects].some(
        (r) => r.bottom >= 0 && r.top <= doc.defaultView.innerHeight,
      )
    )
      continue;
    const text = node.textContent.replace(/\s+/g, " ").trim();
    if (text) {
      pieces.push(text);
      length += text.length + 1;
    }
  }
  return pieces.join("\n").slice(0, 40000);
}
