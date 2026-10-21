export function isChallengePage(title, text) {
  return (
    /^(?:just a moment|attention required|checking your browser)/i.test(
      String(title || "").trim(),
    ) ||
    /(?:performing security verification|verify (?:that )?you are (?:a )?human|verifies you are not a bot|enable javascript and cookies to continue)/i.test(
      String(text || ""),
    )
  );
}
export function pageIdentity(doc, value) {
  const host = new URL(value).hostname.replace(/^www\./, "");
  const originalTitle = (doc.title || "").trim();
  const heading = doc
    .querySelector('h1,[role="heading"][aria-level="1"]')
    ?.textContent?.trim();
  const social = doc
    .querySelector('meta[property="og:title"]')
    ?.content?.trim();
  const siteName =
    doc.querySelector('meta[property="og:site_name"]')?.content?.trim() || host;
  const generic =
    /^(?:untitled(?: form| document)?|home|welcome|document|new tab)$/i.test(
      originalTitle,
    );
  const title =
    (generic
      ? social || heading || originalTitle
      : originalTitle || social || heading) || `Page on ${host}`;
  return {
    title: title.slice(0, 300),
    originalTitle: originalTitle.slice(0, 300),
    siteName: siteName.slice(0, 150),
  };
}
export function pageDetailsExport(page) {
  return {
    format: "ytmind-page-details",
    version: 1,
    exportedAt: new Date().toISOString(),
    scope:
      "Captured page text and recorded browsing activity only; unavailable or private content may be missing.",
    site: page.siteName || new URL(page.url).hostname,
    title: page.title,
    originalTitle: page.originalTitle || page.title,
    url: page.url,
    firstSeenAt: page.firstSeenAt,
    lastSeenAt: page.lastSeenAt,
    visits: page.visits,
    furthestScroll: page.progress,
    text: page.capturedText || page.text,
    activities: page.activities || [],
    personalNotes: page.personalNotes || "",
    outputs: page.outputs || [],
  };
}
export function pageDetailsMarkdown(page) {
  const data = pageDetailsExport(page);
  const stamp = (value) =>
    value ? new Date(value).toISOString() : "Not recorded";
  return `# ${data.title}\n\n## Page details\n\n- Site: ${data.site}\n- Original title: ${data.originalTitle}\n- Source: ${data.url}\n- First captured: ${stamp(data.firstSeenAt)}\n- Last captured: ${stamp(data.lastSeenAt)}\n- Visits recorded: ${data.visits || 0}\n- Furthest scroll: ${data.furthestScroll || 0}%\n\n## Coverage\n\n${data.scope}\nScroll position does not prove every word was read. Form values, passwords and sign-in cookies are excluded.\n\n## Captured page content\n\n${data.text || "No readable text saved."}\n\n## Recorded activity - chronological steps\n\n${
    [...data.activities]
      .sort((a, b) => a.at - b.at)
      .map(
        (a, i) =>
          `${i + 1}. **${a.kind}** - ${stamp(a.at)}\n   ${a.label}${a.targetURL ? "\n   Destination: " + a.targetURL : ""}`,
      )
      .join("\n\n") || "No activity recorded."
  }\n\n## Personal notes\n\n${data.personalNotes || "No personal notes saved."}\n\n## Saved analysis and answers\n\n${data.outputs.map((o) => `### ${o.mode}\n\n${o.question ? "Question: " + o.question + "\n\n" : ""}${o.answer || "No answer saved."}`).join("\n\n") || "No results saved."}`;
}
