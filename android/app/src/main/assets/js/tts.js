/* ============================================
   TTS Module — Google Translate Quality Voices
   仅使用 Google TTS，不保留浏览器语音回退。
   ============================================ */

const TTS = {
  _audio: null,
  _pending: false,
  _aborted: false,
  _speed: 1,

  MAX_CHUNK: 180,

  _googleUrl(text, client) {
    const c = client || 'tw-ob';
    return 'https://translate.google.com/translate_tts?ie=UTF-8&client=' + c + '&tl=en&q=' + encodeURIComponent(text);
  },

  _chunkText(text) {
    const chunks = [];
    const words = text.split(/\s+/);
    let current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      if (test.length > this.MAX_CHUNK && current) {
        chunks.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) chunks.push(current);
    return chunks.length ? chunks : [text];
  },

  /** 朗读文本，返回 Promise，完成后 resolve */
  async speak(text, speed) {
    this.stop();
    this._aborted = false;
    this._speed = speed || 1;
    if (!text || !text.trim()) return;
    const trimmed = text.trim();

    await this._speakWithGoogle(trimmed);
  },

  async _speakWithGoogle(text) {
    const clients = ['tw-ob', 'gtx'];
    if (text.length <= this.MAX_CHUNK) {
      for (const client of clients) {
        if (this._aborted) return;
        try { await this._playGoogle(text, client); return; } catch(e) {}
      }
      return;
    }

    const chunks = this._chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      if (this._aborted) return;
      let ok = false;
      for (const client of clients) {
        if (this._aborted) return;
        try { await this._playGoogle(chunks[i], client); ok = true; break; } catch(e) {}
      }
      if (!ok) return;
    }
  },

  async _playGoogle(text, client) {
    const url = this._googleUrl(text, client);
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = url;
      audio.preload = 'auto';
      audio.playbackRate = this._speed;
      this._audio = audio;
      this._pending = true;

      let timeout = setTimeout(() => {
        this._pending = false; this._audio = null;
        reject(new Error('timeout'));
      }, 15000);

      audio.onended = () => {
        clearTimeout(timeout);
        this._pending = false; this._audio = null;
        resolve();
      };

      audio.onerror = () => {
        clearTimeout(timeout);
        this._pending = false; this._audio = null;
        reject(new Error('audio error'));
      };

      audio.load();
      audio.play().catch(err => {
        clearTimeout(timeout);
        this._pending = false; this._audio = null;
        reject(err);
      });
    });
  },

  stop() {
    this._aborted = true;
    if (this._audio && this._pending) {
      try { this._audio.pause(); this._audio.src = ''; } catch(e) {}
      this._audio = null;
      this._pending = false;
    }
  },

  isSpeaking() {
    return this._pending;
  }
};
