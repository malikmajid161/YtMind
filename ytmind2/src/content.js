// ============================================================
//  YTMind 2.0 — Content Script (bundled to dist/content.js)
//  Detects video changes → Ingestion (ACTA/MALT/KGMA) →
//  wires the Orchestrator (Intent/Retrieval/Gen/SAGE/GAIA/ARIA)
//  to the Chatbot UI.
// ============================================================

import { lifecycle } from './utils/lifecycle.js';
import { IngestionAgent } from './agents/ingestion-agent.js';
import { Orchestrator } from './agents/orchestrator.js';
import { ChatbotUI } from './ui/chatbot-ui.js';

try { performance.setResourceTimingBufferSize(3000); } catch {}
document.getElementById('ytmind-root')?.remove();

let currentVideoId = null;
const attempts = new Map();
const MAX_TRIES = 3;
let chatbot = null;
lifecycle.cleanup(() => chatbot?.destroy());

const ingestion = new IngestionAgent();
const orchestrator = new Orchestrator();

function getVideoId() {
  if (location.pathname !== '/watch') return null;
  return new URLSearchParams(location.search).get('v');
}

function ensureChatbot() {
  if (chatbot) return;
  chatbot = new ChatbotUI();
  chatbot.mount();

  // Main query handler → Orchestrator
  chatbot.onSend = async (text) => {
    const id = getVideoId();
    if (!id) { chatbot.addBotMessage('Open a video first.'); return; }
    chatbot.addThinking('Working...');
    chatbot.setStatus('working', 'Working...');
    try {
      const result = await orchestrator.handle(text, id, (status) => {
        chatbot.addThinking(status);
      });
      chatbot.removeLastThinking();

      if (result.type === 'answer') {
        chatbot.addBotMessage(result.answer, result.verification);
      } else if (result.type === 'quiz') {
        chatbot.renderQuiz(result.quiz);
      } else if (result.type === 'argmap') {
        chatbot.renderArgMap(result.argmap);
      } else if (result.type === 'kgma') {
        chatbot.renderConcepts(result.concepts);
      } else if (result.type === 'error') {
        chatbot.addSystemMessage('⚠️ ' + result.message);
      }
      chatbot.setStatus('ready', 'Ready');
    } catch (err) {
      chatbot.removeLastThinking();
      chatbot.setStatus('error', 'Error');
      chatbot.addSystemMessage('⚠️ ' + this._friendlyError(err));
    }
  };

  chatbot.onAudio = () => {
    // Audio→Text: capture tab audio → MALT.transcribeAudio via ingestion
    chatbot.addSystemMessage('🎙 Audio transcription: play the video, then allow tab audio sharing.');
    startAudioCapture(getVideoId());
  };

  // Click timestamp → seek video
  document.addEventListener('click', (e) => {
    const ts = e.target.closest?.('.ytmind-ts');
    if (ts) {
      const t = parseInt(ts.dataset.t);
      const video = document.querySelector('video.html5-main-video');
      if (video && Number.isFinite(t)) { video.currentTime = t; video.play(); }
    }
  }, { signal: lifecycle.signal });
}

function _friendlyError(err) {
  const m = err.message || '';
  if (m === 'NO_API_KEY') return 'Add your Groq API key in YTMind settings (toolbar icon).';
  if (m === 'INVALID_KEY') return 'Your Groq key was rejected. Check it in settings.';
  if (m === 'RATE_LIMIT') return 'Groq usage limit hit. Wait a minute and retry.';
  return m || 'Something went wrong. Please retry.';
}

// ── Audio capture (MALT audio path) ──
let audioBusy = false;
async function startAudioCapture(videoId) {
  if (audioBusy) return;
  const video = document.querySelector('video.html5-main-video');
  if (!video || video.paused) { chatbot.addSystemMessage('Play the video first.'); return; }

  try {
    audioBusy = true;
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' }, audio: true,
      preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'exclude',
    });
    if (!stream.getAudioTracks().length) {
      chatbot.addSystemMessage('No tab audio shared. Try again and enable "Share tab audio".');
      audioBusy = false;
      return;
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm'].find(x => MediaRecorder.isTypeSupported(x));
    const recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()), { mimeType: mime, audioBitsPerSecond: 64000 });
    const parts = [];
    const offset = video.currentTime;
    recorder.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      chatbot.setSystemLine('Transcribing audio via Whisper...');
      try {
        const blob = new Blob(parts, { type: mime });
        const { MALTAgent } = await import('./agents/malt-agent.js');
        const malt = new MALTAgent();
        const { groq } = await import('./utils/groq-client.js');
        const lang = (await groq.getSettings()).lang === 'urdu' ? 'ur' : 'ur';
        const transcript = await malt.transcribeAudio(blob, lang, offset);
        if (!transcript.length) throw new Error('No speech detected.');
        const title = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || document.title.replace(/ - YouTube$/, '');
        const channel = document.querySelector('#owner #channel-name')?.textContent?.trim() || '';
        await ingestion.storeTranscript({ videoId, title, channel, transcript, source: 'audio' });
        chatbot.setSystemLine('');
        chatbot.addSystemMessage('✅ Audio transcript saved. Ask me about the recorded section!');
        chatbot.setStatus('ready', 'Ready');
      } catch (e) {
        chatbot.setSystemLine('');
        chatbot.addSystemMessage('⚠️ ' + e.message);
      } finally { audioBusy = false; }
    };
    // Stop when video pauses or after 5 min
    for (const ev of ['pause', 'ended']) video.addEventListener(ev, () => recorder.state === 'recording' && recorder.stop(), { once: true });
    setTimeout(() => recorder.state === 'recording' && recorder.stop(), 5 * 60 * 1000);
    recorder.start(1000);
    chatbot.addSystemMessage('🔴 Recording... pause the video when done.');
  } catch (e) {
    audioBusy = false;
    chatbot.addSystemMessage('⚠️ Audio capture cancelled or unavailable.');
  }
}

// ── Video change handler ──
async function onVideoChange(videoId) {
  if (!lifecycle.active()) return lifecycle.dispose();
  ensureChatbot();

  if (!videoId) {
    currentVideoId = null;
    chatbot.setCurrentVideo(null, '');
    chatbot.setGenre(null);
    chatbot.clearSystemLine();
    chatbot.setStatus('idle', 'Open a video');
    return;
  }
  if (videoId === currentVideoId) return;
  currentVideoId = videoId;
  chatbot.setCurrentVideo(videoId, '');
  chatbot.setSystemLine('⏳ Reading this video...');
  chatbot.setStatus('indexing', 'Indexing...');

  try {
    const result = await ingestion.run(videoId);
    if (!lifecycle.active() || videoId !== currentVideoId) return;

    chatbot.setCurrentVideo(videoId, result.title);
    chatbot.setGenre(result.genre);
    attempts.delete(videoId);

    if (result.needsAudio) {
      chatbot.setStatus('idle', 'Audio available');
      chatbot.setSystemLine('No readable captions. Play the video and click 🎙 Audio→Text.');
      return;
    }
    chatbot.setStatus('ready', 'Ready');
    chatbot.clearSystemLine();
    chatbot.addSystemMessage(`📺 **${result.title}** [${result.genre}] — ready. Ask me anything!`);

    // Warn if captions are low quality (e.g. Hindi ASR on Urdu audio)
    if (result.lowQualityCaptions) {
      chatbot.addSystemMessage(`⚠️ YouTube's captions for this video look unreliable (${result.qualityReason}). For accurate Urdu answers, play the video and click 🎙 Audio→Text.`);
    }

    const { ytmind_auto } = await chrome.storage.local.get(['ytmind_auto']);
    if (ytmind_auto && lifecycle.active() && videoId === currentVideoId) {
      chatbot.askAutomatically('Summarize this video');
    }
  } catch (err) {
    if (!lifecycle.active()) return lifecycle.dispose();
    if (videoId !== currentVideoId) return;

    const tries = (attempts.get(videoId) || 0) + 1;
    attempts.set(videoId, tries);
    const needsUser = /context invalidated/i.test(err.message) || !chrome.runtime?.id ||
      err.message === 'NO_API_KEY' || /no captions/i.test(err.message);

    if (!needsUser && tries < MAX_TRIES) {
      chatbot.setStatus('indexing', 'Retrying...');
      setTimeout(() => {
        if (!lifecycle.active() || getVideoId() !== videoId) return;
        currentVideoId = null;
        onVideoChange(videoId);
      }, 6000);
      return;
    }

    chatbot.clearSystemLine();
    if (err.message === 'NO_API_KEY') {
      chatbot.setStatus('error', 'Setup needed');
      chatbot.addSystemMessage('🔑 Open YTMind settings (toolbar icon), add your Groq key, then reload.');
    } else {
      chatbot.setStatus('error', 'Unavailable');
      chatbot.addSystemMessage(`⚠️ ${_friendlyError(err)}`);
      chatbot.addSystemMessage('🎙 No captions? Play the video, then click Audio→Text.');
    }
  }
}

document.addEventListener('yt-navigate-finish', () => onVideoChange(getVideoId()), { signal: lifecycle.signal });
onVideoChange(getVideoId());

// Popup messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!lifecycle.active()) return;
  if (msg.type === 'YTMIND_PING') { sendResponse({ ok: true, version: chrome.runtime.getManifest().version }); return; }
  if (msg.type === 'OPEN_CHAT') {
    ensureChatbot();
    chatbot.openPanel();
    if (msg.justSaved) chatbot.addSystemMessage('✅ All set! Ask me anything about this video.');
    sendResponse({ ok: true });
  }
});

chrome.storage.local.get(['ytmind_open_chat_on_load']).then(async (r) => {
  if (!lifecycle.active()) return;
  if (r.ytmind_open_chat_on_load) {
    await chrome.storage.local.remove('ytmind_open_chat_on_load');
    ensureChatbot();
    chatbot.openPanel();
    chatbot.addSystemMessage('✅ All set! Open any video and ask me about it.');
  }
});
