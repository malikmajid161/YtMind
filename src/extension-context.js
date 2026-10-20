export function extensionAvailable(api = globalThis.chrome) {
  try {
    return !!api?.runtime?.id && !!api.runtime.getManifest();
  } catch {
    return false;
  }
}
export function contextMessage(message) {
  return /extension context invalidated/i.test(String(message))
    ? "YTMind was updated. Refresh this YouTube page and reopen YTMind; your saved history is retained."
    : String(message);
}
