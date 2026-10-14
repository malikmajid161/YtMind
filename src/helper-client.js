const endpoint = "http://127.0.0.1:4175/api/media";
export async function helperRequest(
  message,
  fetcher = fetch,
  extensionId = globalThis.chrome?.runtime?.id,
) {
  let url = endpoint,
    options = {};
  if (message.operation === "health") url += "/health";
  else if (message.operation === "create") {
    if (!/^[A-Za-z0-9_-]{11}$/.test(message.videoId || ""))
      throw new Error("Invalid video identifier.");
    options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: message.videoId }),
    };
  } else if (["status", "audio"].includes(message.operation)) {
    if (!/^[a-f0-9-]{36}$/.test(message.jobId || ""))
      throw new Error("Invalid audio job.");
    url += `/${message.jobId}`;
    if (message.operation === "audio") {
      if (
        !Number.isInteger(message.index) ||
        message.index < 0 ||
        message.index > 100
      )
        throw new Error("Invalid audio section.");
      url += `/audio/${message.index}`;
    }
  } else throw new Error("Unknown helper operation.");
  let response;
  if (/^[a-p]{32}$/.test(extensionId || "")) {
    options.headers = { ...options.headers, "X-YTMind-Extension": extensionId };
  }
  try {
    response = await fetcher(url, {
      ...options,
      signal: AbortSignal.timeout(
        message.operation === "health" ? 2500 : 20000,
      ),
    });
  } catch {
    throw new Error(
      "Local audio helper could not be reached. It must be running on port 4175.",
    );
  }
  if (message.operation === "audio" && response.ok) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 24 * 1024 * 1024)
      throw new Error("Audio section exceeds the supported size.");
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return { base64: btoa(binary) };
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Local helper request failed.");
  return result;
}
