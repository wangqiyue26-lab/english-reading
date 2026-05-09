/* ============================================
   Translator Module - Sentence & Full Translation
   ============================================ */

const Translator = {
  cache: {},
  // Pre-built translations from article data
  _prebuilt: {},

  init() { },

  /** Store pre-built translations from the article data */
  setArticle(id, sentences, fullTranslation) {
    this._prebuilt[id] = {
      sentences: {},    // index -> Chinese
      full: fullTranslation || ''
    };
    sentences.forEach((s, i) => {
      if (s.zh) this._prebuilt[id].sentences[i] = s.zh;
    });
  },

  /** Get sentence translation - pre-built first, API fallback */
  async translateSentence(articleId, sentenceIndex, sentenceText) {
    // Check pre-built
    if (this._prebuilt[articleId]?.sentences[sentenceIndex]) {
      return this._prebuilt[articleId].sentences[sentenceIndex];
    }
    // Check cache
    const cacheKey = `${articleId}_s_${sentenceIndex}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    // API fallback
    const zh = await this._callAPI(sentenceText);
    if (zh) {
      this.cache[cacheKey] = zh;
    }
    return zh;
  },

  /** Get full translation */
  async translateFull(articleId, paragraphs) {
    // Check pre-built
    if (this._prebuilt[articleId]?.full) {
      return this._prebuilt[articleId].full;
    }

    const cacheKey = `${articleId}_full`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    // Translate each paragraph
    const results = [];
    for (const p of paragraphs) {
      const zh = await this._callAPI(p);
      results.push(zh || '');
    }
    const full = results.join('\n\n');
    this.cache[cacheKey] = full;
    return full;
  },

  /** Batch translate all sentences of an article */
  async translateAllSentences(articleId, sentences) {
    const results = [];
    for (let i = 0; i < sentences.length; i++) {
      const zh = await this.translateSentence(articleId, i, sentences[i].text);
      results.push(zh || '');
    }
    return results;
  },

  async _callAPI(text) {
    if (!text || text.trim().length < 2) return text;
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh`
      );
      const data = await res.json();
      return data.responseData?.translatedText || '';
    } catch (e) {
      console.error('Translation error:', e);
      return '';
    }
  }
};
