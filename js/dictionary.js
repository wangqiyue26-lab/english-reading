/* ============================================
   Dictionary Module - Word Lookup & Pronunciation
   Robust version for all browsers
   ============================================ */

const Dictionary = {
  cache: {},
  synth: null,
  _voice: null,
  _initialized: false,

  init() {
    try {
      this.synth = window.speechSynthesis || null;
      if (this.synth) {
        try { this._findVoice(); } catch(e) { /* ignore */ }
        // Some browsers load voices async
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => { try { this._findVoice(); } catch(e) {} };
        }
      }
      this._initialized = true;
    } catch(e) {
      this.synth = null;
      this._initialized = true;
    }
  },

  _findVoice() {
    if (!this.synth) return;
    try {
      const voices = this.synth.getVoices();
      if (!voices || !voices.length) return;
      this._voice = voices.find(v => v.lang === 'en-US' && v.name.includes('Female'))
        || voices.find(v => v.lang === 'en-US')
        || voices.find(v => v.lang && v.lang.startsWith('en'));
    } catch(e) { /* ignore */ }
  },

  async lookup(word) {
    if (!word) return { word: '', phonetic: '', meanings: [] };
    const w = word.toLowerCase().trim();
    if (this.cache[w]) return this.cache[w];

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
      if (!res.ok) {
        return await this._translateWord(w);
      }
      const data = await res.json();
      const entry = data[0];

      const result = {
        word: entry.word || w,
        phonetic: entry.phonetic || (entry.phonetics && entry.phonetics[0] && entry.phonetics[0].text) || '',
        audio: '',
        meanings: []
      };

      for (const meaning of (entry.meanings || [])) {
        for (const def of (meaning.definitions || [])) {
          result.meanings.push({
            pos: meaning.partOfSpeech || '',
            definition: def.definition || '',
            example: def.example || ''
          });
          if (result.meanings.length >= 3) break;
        }
        if (result.meanings.length >= 3) break;
      }

      const zh = await this._getChinese(w);
      if (zh) {
        result.meanings.unshift({ pos: 'zh', definition: zh, example: '' });
      }

      this.cache[w] = result;
      return result;
    } catch (e) {
      return { word: w, phonetic: '', meanings: [{ pos: '', definition: 'Lookup failed', example: '' }] };
    }
  },

  async _translateWord(word) {
    const zh = await this._getChinese(word);
    if (!zh) return { word, phonetic: '', meanings: [{ pos: '', definition: 'No result', example: '' }] };
    return { word, phonetic: '', meanings: [{ pos: 'zh', definition: zh, example: '' }] };
  },

  async _getChinese(word) {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh`);
      if (!res.ok) return '';
      const data = await res.json();
      return (data.responseData && data.responseData.translatedText) || '';
    } catch { return ''; }
  },

  speak(word) {
    return TTS.speak(word);
  }
};
