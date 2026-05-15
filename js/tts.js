/* ============================================
   TTS Module - Google Translate Quality Voices
   Uses Google TTS endpoint for natural speech,
   falls back to browser speechSynthesis.
   ============================================ */

const TTS = {
  _audio: null,
  _pending: false,
  _aborted: false,

  MAX_CHUNK: 180, // Google TTS max chars per request

  /** Get Google TTS URL for given text - try multiple clients */
  _googleUrl(text, client) {
    const c = client || 'tw-ob';
    return 'https://translate.google.com/translate_tts?ie=UTF-8&client=' + c + '&tl=en&q=' + encodeURIComponent(text);
  },

  /** Split text into chunks at word boundaries, each <= MAX_CHUNK chars */
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

  /** Speak text - returns Promise that resolves when done */
  async speak(text) {
    this.stop();
    this._aborted = false;
    if (!text || !text.trim()) return;
    const trimmed = text.trim();

    // Try Google TTS with multiple client fallbacks
    try {
      await this._speakWithGoogle(trimmed);
      return;
    } catch(e) { /* Google failed, use browser */ }

    // Fallback: browser speechSynthesis
    await this._speakBrowserAsync(trimmed);
  },

  /** Try Google TTS, chunking if needed, trying multiple clients */
  async _speakWithGoogle(text) {
    const clients = ['tw-ob', 'gtx'];
    if (text.length <= this.MAX_CHUNK) {
      // Short text: try each client
      for (const client of clients) {
        if (this._aborted) throw new Error('aborted');
        try { await this._playGoogle(text, client); return; } catch(e) {}
      }
      throw new Error('All clients failed');
    }

    // Longer text: chunk and play sequentially
    const chunks = this._chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      if (this._aborted) return;
      let ok = false;
      for (const client of clients) {
        try { await this._playGoogle(chunks[i], client); ok = true; break; } catch(e) {}
      }
      if (!ok) {
        // Google failed mid-stream, speak remaining via browser
        await this._speakBrowserAsync(chunks.slice(i).join(' '));
        return;
      }
    }
  },

  /** Play a single chunk via Google TTS Audio element */
  async _playGoogle(text, client) {
    const url = this._googleUrl(text, client);
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = url;
      audio.preload = 'auto';
      this._audio = audio;
      this._pending = true;

      let timeout = setTimeout(() => {
        this._pending = false; this._audio = null;
        reject(new Error('timeout'));
      }, 10000);

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

  /** Browser speechSynthesis as Promise */
  async _speakBrowserAsync(text) {
    if (!window.speechSynthesis) return;
    return new Promise((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 0.88;
      utter.pitch = 1.0;
      utter.volume = 1;

      // Best voice selection by priority
      const voices = speechSynthesis.getVoices();
      // On Chrome, Google provides high-quality neural voices
      let voice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google') && v.localService);
      // On Edge/Win11, Microsoft has natural voices
      if (!voice) voice = voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('natural'));
      // Microsoft en-US voices by quality: Aria, Jenny, Michelle, Ana, Zira
      if (!voice) voice = voices.find(v => v.lang === 'en-US' && v.name.includes('Microsoft') && v.name.includes('Online'));
      // Any high-quality en-US voice
      if (!voice) voice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Aria') || v.name.includes('Jenny') || v.name.includes('Samantha') || v.name.includes('Karen')));
      // Fallback to any en-US
      if (!voice) voice = voices.find(v => v.lang === 'en-US');
      // Last resort: any English
      if (!voice) voice = voices.find(v => v.lang && v.lang.startsWith('en'));

      if (voice) utter.voice = voice;

      utter.onend = () => resolve();
      utter.onerror = () => resolve(); // Resolve anyway to continue

      window.speechSynthesis.speak(utter);
    });
  },

  /** Stop any ongoing TTS */
  stop() {
    this._aborted = true;
    if (this._audio && this._pending) {
      try { this._audio.pause(); this._audio.src = ''; } catch(e) {}
      this._audio = null;
      this._pending = false;
    }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e) {}
  },

  /** Check if TTS is currently speaking */
  isSpeaking() {
    return this._pending;
  }
};
