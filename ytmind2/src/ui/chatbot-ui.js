// ============================================================
//  Chatbot UI — the panel injected into YouTube.
//  Renders chat, SAGE verification badges, quiz cards,
//  and argument maps.
// ============================================================

export class ChatbotUI {
  constructor() {
    this.root = null;
    this.panel = null;
    this.messagesEl = null;
    this.inputEl = null;
    this.currentVideoId = null;
    this.currentVideoTitle = '';
    this.genre = null;

    // callbacks (wired by content.js)
    this.onSend = null;
    this.onAudio = null;
    this.onStopAudio = null;
    this.onRetry = null;
    this.onQuiz = null;
    this.onArgMap = null;
    this.onSummarize = null;
    this.onKeyPoints = null;
  }

  mount() {
    if (document.getElementById('ytmind-root')) return;

    this.root = document.createElement('div');
    this.root.id = 'ytmind-root';

    // Floating button
    this.button = document.createElement('button');
    this.button.id = 'ytmind-fab';
    this.button.innerHTML = '🧠';
    this.button.title = 'YTMind 2.0';
    this.button.onclick = () => this.togglePanel();
    this.root.appendChild(this.button);

    // Panel
    this.panel = document.createElement('div');
    this.panel.id = 'ytmind-panel';
    this.panel.style.display = 'none';
    this.panel.innerHTML = `
      <div id="ytmind-header">
        <span id="ytmind-title">🧠 YTMind 2.0 <span id="ytmind-genre-badge"></span></span>
        <div>
          <span id="ytmind-status" class="ytmind-status">idle</span>
          <button id="ytmind-close">✕</button>
        </div>
      </div>
      <div id="ytmind-system-line"></div>
      <div id="ytmind-messages"></div>
      <div id="ytmind-quick">
        <button data-act="summarize">📝 Summarize</button>
        <button data-act="keypoints">🎯 Key Points</button>
        <button data-act="quiz">❓ Quiz Me</button>
        <button data-act="argmap">🗺️ Arguments</button>
        <button data-act="audio">🎙 Audio→Text</button>
      </div>
      <div id="ytmind-input-row">
        <input id="ytmind-input" placeholder="Ask about this video... (Urdu/English)" />
        <button id="ytmind-send">➤</button>
      </div>
    `;
    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);

    this.messagesEl = this.panel.querySelector('#ytmind-messages');
    this.inputEl = this.panel.querySelector('#ytmind-input');
    this.statusEl = this.panel.querySelector('#ytmind-status');
    this.systemLineEl = this.panel.querySelector('#ytmind-system-line');
    this.genreBadgeEl = this.panel.querySelector('#ytmind-genre-badge');

    // Events
    this.panel.querySelector('#ytmind-close').onclick = () => this.closePanel();
    this.panel.querySelector('#ytmind-send').onclick = () => this._send();
    this.inputEl.onkeydown = (e) => { if (e.key === 'Enter') this._send(); };

    this.panel.querySelector('#ytmind-quick').addEventListener('click', (e) => {
      const act = e.target.getAttribute('data-act');
      if (act === 'summarize') this._quickSend('Summarize this video');
      else if (act === 'keypoints') this._quickSend('Give me the key points');
      else if (act === 'quiz') this._quickSend('Quiz me');
      else if (act === 'argmap') this._quickSend('Show the argument map');
      else if (act === 'audio') this.onAudio?.();
    });
  }

  _send() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = '';
    this.addUserMessage(text);
    this.onSend?.(text);
  }

  _quickSend(text) {
    this.addUserMessage(text);
    this.onSend?.(text);
  }

  askAutomatically(text) {
    this.addUserMessage(text);
    this.onSend?.(text);
  }

  // ── Panel visibility ──
  togglePanel() {
    const open = this.panel.style.display !== 'none';
    this.panel.style.display = open ? 'none' : 'flex';
  }
  openPanel() { 
    this.panel.style.display = 'flex'; 
    this.panel.style.visibility = 'visible';
  }
  closePanel() { this.panel.style.display = 'none'; }

  // ── State setters ──
  setCurrentVideo(id, title) {
    this.currentVideoId = id;
    this.currentVideoTitle = title || '';
  }
  setGenre(genre) {
    this.genre = genre;
    if (this.genreBadgeEl) {
      this.genreBadgeEl.textContent = genre ? `· ${genre}` : '';
    }
  }
  setStatus(state, text) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text || state;
    this.statusEl.className = `ytmind-status ytmind-status-${state}`;
  }
  setSystemLine(text) { if (this.systemLineEl) this.systemLineEl.textContent = text; }
  clearSystemLine() { if (this.systemLineEl) this.systemLineEl.textContent = ''; }

  // ── Messages ──
  addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'ytmind-msg ytmind-msg-user';
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this._scroll();
  }

  addSystemMessage(text) {
    const el = document.createElement('div');
    el.className = 'ytmind-msg ytmind-msg-system';
    el.innerHTML = this._formatMarkdown(text);
    this.messagesEl.appendChild(el);
    this._scroll();
  }

  // Bot message with SAGE verification badge
  addBotMessage(text, verification = null) {
    const el = document.createElement('div');
    el.className = 'ytmind-msg ytmind-msg-bot';

    // Verification badge
    if (verification) {
      const badge = this._verificationBadge(verification);
      el.appendChild(badge);
    }

    const body = document.createElement('div');
    body.className = 'ytmind-msg-body';
    body.innerHTML = this._formatMarkdown(text);
    el.appendChild(body);

    this.messagesEl.appendChild(el);
    this._scroll();
  }

  _verificationBadge(v) {
    const badge = document.createElement('div');
    const map = {
      'SOURCE-GROUNDED': { cls: 'green', icon: '✅', label: 'Source-grounded' },
      'INSUFFICIENT-EVIDENCE': { cls: 'yellow', icon: '⚠️', label: 'Limited evidence' },
      'CONTRADICTED': { cls: 'red', icon: '❌', label: 'Possible contradiction' },
    };
    const info = map[v.overall] || map['INSUFFICIENT-EVIDENCE'];
    badge.className = `ytmind-badge ytmind-badge-${info.cls}`;
    badge.innerHTML = `${info.icon} ${info.label} <span class="ytmind-badge-score">(${Math.round(v.score * 100)}% of claims grounded)</span>`;
    badge.title = 'SAGE verified this answer against the video transcript. Green = supported by the video (not a truth guarantee).';
    return badge;
  }

  // ── Quiz card ──
  renderQuiz(quiz) {
    const el = document.createElement('div');
    el.className = 'ytmind-msg ytmind-msg-bot ytmind-quiz';

    let idx = 0;
    let score = 0;
    const questions = quiz.questions;

    const render = () => {
      if (idx >= questions.length) {
        el.innerHTML = `<div class="ytmind-quiz-done">🎉 Quiz complete! Score: <b>${score}/${questions.length}</b></div>`;
        return;
      }
      const q = questions[idx];
      el.innerHTML = `
        <div class="ytmind-quiz-q">
          <div class="ytmind-quiz-num">Question ${idx + 1}/${questions.length} · ${q.difficulty}</div>
          <div class="ytmind-quiz-text">${this._esc(q.question)}</div>
          <div class="ytmind-quiz-opts"></div>
          <div class="ytmind-quiz-feedback"></div>
        </div>`;
      const optsEl = el.querySelector('.ytmind-quiz-opts');
      const fbEl = el.querySelector('.ytmind-quiz-feedback');
      q.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'ytmind-quiz-opt';
        b.textContent = opt;
        b.onclick = () => {
          if (fbEl.dataset.answered) return;
          fbEl.dataset.answered = '1';
          if (i === q.correctIndex) {
            b.classList.add('correct');
            score++;
            fbEl.innerHTML = `✅ Correct! <span class="ytmind-quiz-ev">${this._esc(q.evidence)} (${q.timestamp})</span>`;
          } else {
            b.classList.add('wrong');
            optsEl.children[q.correctIndex]?.classList.add('correct');
            fbEl.innerHTML = `❌ The answer is: <b>${this._esc(q.options[q.correctIndex])}</b><br><span class="ytmind-quiz-ev">${this._esc(q.evidence)} (${q.timestamp})</span>`;
          }
          const next = document.createElement('button');
          next.className = 'ytmind-quiz-next';
          next.textContent = idx + 1 < questions.length ? 'Next →' : 'See score';
          next.onclick = () => { idx++; render(); };
          fbEl.appendChild(next);
        };
        optsEl.appendChild(b);
      });
    };
    render();
    this.messagesEl.appendChild(el);
    this._scroll();
  }

  // ── Argument map (simple nested list; D3 optional) ──
  renderArgMap(argmap) {
    const el = document.createElement('div');
    el.className = 'ytmind-msg ytmind-msg-bot ytmind-argmap';
    if (!argmap.arguments?.length) {
      el.innerHTML = '<i>No clear argument structure found in this video.</i>';
      this.messagesEl.appendChild(el);
      return;
    }
    let html = '<div class="ytmind-argmap-title">🗺️ Argument Map</div>';
    for (const a of argmap.arguments) {
      html += `<div class="ytmind-arg">
        <div class="ytmind-arg-claim">💬 <b>${this._esc(a.claim)}</b> ${a.speaker ? `<span class="ytmind-arg-speaker">— ${this._esc(a.speaker)}</span>` : ''} ${a.isEndorsed === false ? '<span class="ytmind-arg-quoted">(quoted)</span>' : ''}</div>`;
      (a.evidence || []).forEach(e =>
        html += `<div class="ytmind-arg-ev">✔️ ${this._esc(e.text)} <span class="ytmind-arg-time">${e.timestamp || ''}</span></div>`);
      (a.counterarguments || []).forEach(c =>
        html += `<div class="ytmind-arg-counter">✖️ ${this._esc(c.text)} <span class="ytmind-arg-time">${c.timestamp || ''}</span></div>`);
      (a.rebuttals || []).forEach(r =>
        html += `<div class="ytmind-arg-rebut">↩️ ${this._esc(r.text)} <span class="ytmind-arg-time">${r.timestamp || ''}</span></div>`);
      html += '</div>';
    }
    el.innerHTML = html;
    this.messagesEl.appendChild(el);
    this._scroll();
  }

  // ── KGMA concepts ──
  renderConcepts(concepts) {
    const el = document.createElement('div');
    el.className = 'ytmind-msg ytmind-msg-bot';
    let html = '<div class="ytmind-argmap-title">🧩 What you\'ve learned</div>';
    for (const c of concepts) {
      const vids = c.sources?.length || 1;
      html += `<div class="ytmind-arg">
        <div class="ytmind-arg-claim"><b>${this._esc(c.name)}</b></div>
        <div class="ytmind-arg-ev">${this._esc(c.definition)}</div>
        <div class="ytmind-arg-time">Seen in ${vids} video${vids > 1 ? 's' : ''}</div>
      </div>`;
    }
    el.innerHTML = html;
    this.messagesEl.appendChild(el);
    this._scroll();
  }

  removeLastThinking() {
    const t = this.messagesEl.querySelector('.ytmind-thinking');
    if (t) t.remove();
  }
  addThinking(text = 'Thinking...') {
    this.removeLastThinking();
    const el = document.createElement('div');
    el.className = 'ytmind-msg ytmind-msg-bot ytmind-thinking';
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this._scroll();
  }

  // ── Helpers ──
  _scroll() { this.messagesEl.scrollTop = this.messagesEl.scrollHeight; }
  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  _formatMarkdown(text) {
    let html = this._esc(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    // clickable timestamps m:ss
    html = html.replace(/\b(\d{1,2}):(\d{2})\b/g, (m, mm, ss) => {
      const secs = parseInt(mm) * 60 + parseInt(ss);
      return `<a class="ytmind-ts" data-t="${secs}">${m}</a>`;
    });
    html = html.replace(/^- (.+)$/gm, '• $1');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  destroy() { this.root?.remove(); }
}
