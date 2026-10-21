import { TTL } from "./core.js";
export async function browserHistoryStatus(api, now = Date.now()) {
  const enabled = await api.permissions.contains({ permissions: ["history"] });
  if (!enabled) return { enabled: false, entries: [] };
  const items = await api.history.search({
    text: "",
    startTime: now - TTL,
    maxResults: 10000,
  });
  return {
    enabled: true,
    retentionHours: 24,
    limit: 10000,
    entries: items.map(({ url, title, lastVisitTime, visitCount }) => ({
      url,
      title,
      lastVisitTime,
      visitCount,
    })),
  };
}
export async function maintainBrowserHistory(api, now = Date.now()) {
  if (!(await api.permissions?.contains({ permissions: ["history"] })))
    return { enabled: false };
  // Only browsing visit records are removed. Cookies, credentials and site data
  // are never passed to a deletion API.
  await api.history.deleteRange({ startTime: 0, endTime: now - TTL });
  const status = await browserHistoryStatus(api, now);
  return { enabled: true, count: status.entries.length };
}
