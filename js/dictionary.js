/* ============================================
   Dictionary Module - Word Lookup & Pronunciation
   ============================================ */

const Dictionary = {
  cache: {},
  synth: null,
  _voice: null,

  init() {
    this.synth = window.speechSynthesis;
    // Find American English voice
    this._findVoice();
  },

  _findVoice() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // Prefer US female voice
    this._voice = voices.find(v => v.lang === 'en-US' && v.name.includes('Female'))
      || voices.find(v => v.lang === 'en-US')
      || voices.find(v => v.lang.startsWith('en'));
  },

  async lookup(word) {
    const w = word.toLowerCase().trim();
    if (this.cache[w]) return this.cache[w];

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
      if (!res.ok) {
        // Try MyMemory for Chinese translation as fallback
        return await this._translateWord(w);
      }
      const data = await res.json();
      const entry = data[0];

      const result = {
        word: entry.word,
        phonetic: entry.phonetic || (entry.phonetics?.[0]?.text) || '',
        audio: entry.phonetics?.find(p => p.audio)?.audio || '',
        meanings: []
      };

      // Extract Chinese-relevant definitions
      for (const meaning of entry.meanings || []) {
        for (const def of meaning.definitions || []) {
          result.meanings.push({
            pos: meaning.partOfSpeech,
            definition: def.definition,
            example: def.example || ''
          });
          if (result.meanings.length >= 3) break;
        }
        if (result.meanings.length >= 3) break;
      }

      // Try to get Chinese translation via MyMemory
      const zh = await this._getChinese(w);
      if (zh) {
        result.meanings.unshift({ pos: 'zh', definition: zh, example: '' });
      }

      this.cache[w] = result;
      return result;
    } catch (e) {
      console.error('Dictionary lookup error:', e);
      return { word, phonetic: '', meanings: [{ pos: '', definition: 'Lookup failed', example: '' }] };
    }
  },

  async _translateWord(word) {
    const zh = await this._getChinese(word);
    if (!zh) return { word, phonetic: '', meanings: [{ pos: '', definition: 'No result', example: '' }] };
    return {
      word,
      phonetic: '',
      meanings: [{ pos: 'zh', definition: zh, example: '' }]
    };
  },

  async _getChinese(word) {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh`);
      const data = await res.json();
      return data.responseData?.translatedText || '';
    } catch { return ''; }
  },

  async speak(word) {
    if (!this.synth) {
      App.toast('Speech not supported');
      return;
    }
    // Cancel any ongoing speech
    this.synth.cancel();

    const voices = this.synth.getVoices();
    const voice = voices.find(v => v.lang === 'en-US')
      || voices.find(v => v.lang.startsWith('en'));

    const utter = new SpeechSynthesisUtterance(word);
    utter.voice = voice || null;
    utter.lang = 'en-US';
    utter.rate = 0.9;
    utter.pitch = 1;
    this.synth.speak(utter);
    return utter;
  }
};
