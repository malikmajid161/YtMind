async function load() {
  const r = await chrome.storage.local.get(['ytmind_api_key', 'ytmind_length', 'ytmind_lang', 'ytmind_auto']);
  if (r.ytmind_api_key) document.getElementById('apiKey').value = r.ytmind_api_key;
  if (r.ytmind_length) document.getElementById('length').value = r.ytmind_length;
  if (r.ytmind_lang) document.getElementById('lang').value = r.ytmind_lang;
  document.getElementById('auto').checked = !!r.ytmind_auto;
}

document.getElementById('save').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const length = document.getElementById('length').value;
  const lang = document.getElementById('lang').value;
  const auto = document.getElementById('auto').checked;
  const status = document.getElementById('status');

  if (!apiKey) { status.textContent = 'Please enter your Groq API key.'; status.style.color = '#ef4444'; return; }

  await chrome.storage.local.set({
    ytmind_api_key: apiKey, ytmind_length: length, ytmind_lang: lang, ytmind_auto: auto,
  });
  status.textContent = '✅ Saved!'; status.style.color = '#22c55e';

  // Open chat on the active YouTube tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('youtube.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_CHAT', justSaved: true }, () => {
      if (chrome.runtime.lastError) {
        chrome.storage.local.set({ ytmind_open_chat_on_load: true });
      }
    });
  } else {
    await chrome.storage.local.set({ ytmind_open_chat_on_load: true });
    chrome.tabs.create({ url: 'https://www.youtube.com' });
  }
  setTimeout(() => window.close(), 800);
});

load();
