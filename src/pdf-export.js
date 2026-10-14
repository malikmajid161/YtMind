export function openPDFExport(outputs, title) {
  if (!outputs?.length || outputs.some((output) => !output?.answer))
    throw new Error("Generate notes before exporting a PDF.");
  const id = crypto.randomUUID(),
    prefix = "ytmind-print:";
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix)) continue;
    try {
      if (
        Date.now() - JSON.parse(localStorage.getItem(key)).createdAt >
        86400000
      )
        localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
  localStorage.setItem(
    prefix + id,
    JSON.stringify({
      title,
      createdAt: Date.now(),
      outputs: outputs.map((o) => ({
        answer: o.answer,
        query: o.query,
        verification: o.verification,
        evidence: o.evidence,
      })),
    }),
  );
  const path = `print.html?id=${id}`;
  if (globalThis.chrome?.runtime?.id)
    return chrome.tabs.create({ url: chrome.runtime.getURL(path) });
  const tab = window.open(new URL(path, location.href), "_blank");
  if (!tab)
    throw new Error(
      "Allow this workspace to open the PDF export tab, then retry.",
    );
}
