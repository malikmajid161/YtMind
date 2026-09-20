// ============================================================
//  Background Service Worker — 24hr session lifecycle.
// ============================================================

const SESSION_KEY = 'ytmind_session_start';
const SESSION_TTL = 24 * 60 * 60 * 1000;

async function getSessionStatus() {
  const { [SESSION_KEY]: start } = await chrome.storage.local.get(SESSION_KEY);
  if (!start) return { active: false };
  const elapsed = Date.now() - start;
  if (elapsed > SESSION_TTL) {
    await resetSession();
    return { active: false, expired: true };
  }
  return { active: true, remainingMs: SESSION_TTL - elapsed };
}

async function startSession() {
  await chrome.storage.local.set({ [SESSION_KEY]: Date.now() });
  chrome.alarms.create('session_expiry', { delayInMinutes: SESSION_TTL / 60000 });
  return { active: true };
}

async function resetSession() {
  await chrome.storage.local.remove([SESSION_KEY, 'ytmind_videos', 'ytmind_video_count']);
  // Clear IndexedDB video store
  try {
    const req = indexedDB.deleteDatabase('ytmind2_db');
    await new Promise(res => { req.onsuccess = res; req.onerror = res; req.onblocked = res; });
  } catch {}
  return { active: false };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'GET_SESSION_STATUS') sendResponse(await getSessionStatus());
      else if (msg.type === 'START_SESSION') sendResponse(await startSession());
      else if (msg.type === 'RESET_SESSION') sendResponse(await resetSession());
      else sendResponse({ error: 'Unknown message type' });
    } catch (e) {
      sendResponse({ error: e.message });
    }
  })();
  return true; // async
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'session_expiry') {
    const status = await getSessionStatus();
    if (!status.active) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'YTMind session ended',
        message: 'Your 24-hour session expired. A fresh session will start on the next video.',
      });
    }
  }
});
