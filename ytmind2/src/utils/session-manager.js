// ============================================================
//  Session Manager — talks to background for 24hr session.
// ============================================================

export class SessionManager {
  async ensureActive() {
    const status = await this._send({ type: 'GET_SESSION_STATUS' });
    if (!status.active) await this._send({ type: 'START_SESSION' });
  }
  async getStatus() { return this._send({ type: 'GET_SESSION_STATUS' }); }
  async reset() { return this._send({ type: 'RESET_SESSION' }); }

  _send(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (!response || response.error) reject(new Error(response?.error || 'Background did not respond.'));
        else resolve(response);
      });
    });
  }
}
