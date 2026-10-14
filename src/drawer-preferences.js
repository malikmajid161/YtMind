export async function readDrawerWidth(api = globalThis.chrome) {
  try {
    const reply = await api?.runtime?.sendMessage({
      type: "DRAWER_PREFERENCE",
    });
    return Number.isFinite(reply?.data?.width) ? reply.data.width : 460;
  } catch {
    return 460;
  }
}
export async function saveDrawerWidth(width, api = globalThis.chrome) {
  try {
    await api?.runtime?.sendMessage({ type: "DRAWER_PREFERENCE", width });
  } catch {
    /* Preference errors must not prevent opening the workspace. */
  }
}
