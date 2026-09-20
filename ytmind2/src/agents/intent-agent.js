// ============================================================
//  🤖 Intent Agent — routes the user's message to the right
//  action: question, summary, export, comparison, quiz, argmap.
// ============================================================

export class IntentAgent {
  run(userMessage) {
    const msg = userMessage.toLowerCase().trim();

    if (this._m(msg, ['quiz', 'test me', 'quiz me', 'imtihan', 'سوال', 'کوئز'])) {
      return { type: 'quiz', retrieval: 'current_video' };
    }
    if (this._m(msg, ['argument map', 'argument', 'debate map', 'claims', 'dalail', 'دلائل', 'بحث'])) {
      return { type: 'argmap', retrieval: 'current_video' };
    }
    if (this._m(msg, ['make a word', 'create a word', 'export doc', 'make a document', 'word file', 'download document'])) {
      return { type: 'export', format: 'docx', retrieval: 'cross_video' };
    }
    if (this._m(msg, ['markdown', 'notion', 'give me notes', 'save as notes'])) {
      return { type: 'export', format: 'markdown', retrieval: 'cross_video' };
    }
    if (this._m(msg, ['bullet list', 'make a list', 'key points', 'main points', 'اہم نکات'])) {
      return { type: 'export', format: 'list', retrieval: 'cross_video' };
    }
    if (this._m(msg, ['summarize', 'summary', 'tldr', 'overview', 'خلاصہ', 'summarise'])) {
      const scope = /all|today|session|every/.test(msg) ? 'cross_video' : 'current_video';
      return { type: 'summary', retrieval: scope };
    }
    if (this._m(msg, ['compare', 'vs', 'versus', 'difference between', 'both videos'])) {
      return { type: 'comparison', retrieval: 'comparison' };
    }
    if (this._m(msg, ['all videos', 'every video', 'across videos', 'so far', 'what did i watch', 'what do i know'])) {
      return { type: 'question', retrieval: 'cross_video' };
    }
    return { type: 'question', retrieval: 'current_video' };
  }

  _m(text, phrases) {
    return phrases.some(p => text.includes(p));
  }
}
