// ============================================================
//  Lifecycle — tracks whether the content script is still
//  valid (page not navigated away / extension not reloaded).
// ============================================================

class Lifecycle {
  constructor() {
    this._active = true;
    this._controller = new AbortController();
    this._cleanups = [];
  }
  get signal() { return this._controller.signal; }
  active() { return this._active && !!chrome.runtime?.id; }
  cleanup(fn) { this._cleanups.push(fn); }
  dispose() {
    if (!this._active) return;
    this._active = false;
    this._controller.abort();
    this._cleanups.forEach(fn => { try { fn(); } catch {} });
    this._cleanups = [];
  }
}

export const lifecycle = new Lifecycle();
