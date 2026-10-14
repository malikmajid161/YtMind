export async function readDrawerWidth(api = globalThis.chrome) {
  try {
    const value = await api?.storage?.local?.get("drawerWidth");
    return Number.isFinite(value?.drawerWidth) ? value.drawerWidth : 460;
  } catch {
    return 460;
  }
}
export async function saveDrawerWidth(width, api = globalThis.chrome) {
  try {
    await api?.storage?.local?.set({ drawerWidth: width });
  } catch {
    /* Preference errors must not prevent opening the workspace. */
  }
}
