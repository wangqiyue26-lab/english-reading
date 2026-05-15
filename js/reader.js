/* ============================================
   Reader Module - Reading Interface with Settings
   ============================================ */

const Reader = {
  article: null,
  sentences: [],
  currentWord: null,
  popupEl: null,
  progressTimer: null,
  _readArticles: [],
  _bookmarkedArticles: [],
  state: {
    sentenceTranslation: false,
    fullTranslation: false,
    aiSummary: false
  },

  init() {
    this.popupEl = document.getElementById('word-popup');
    this._loadArticleStates();
    this._bindEvents();
  },

  _bindEvents() {
    document.addEventListener('click', (e) => {
      if (this.popupEl && !this.popupEl.contains(e.target) && !e.target.closest('.word-span')) {
        this.hidePopup();
      }
    });

    // Scroll-based progress
    document.addEventListener('scroll', () => this._updateProgress(), { passive: true });
  },

  async open(article) {
    // Stop any ongoing reading
    this._stopReading();
    
    this.article = article;
    this.sentences = [];
    this.state.sentenceTranslation = false;
    this.state.fullTranslation = false;
    this.state.aiSummary = false;

    // Update action button states
    this._updateActionButtons();

    // Apply reader styles from settings
    this._applySettings();

    // Update header
    const jName = Settings.get('language') === 'zh' ? (article.journalZh || article.journal) : (article.journalEn || article.journal);
    document.getElementById('reader-journal').textContent = jName;
    document.getElementById('reader-title').textContent = article.title;
    document.getElementById('reader-meta').innerHTML = `
      ${article.difficultyLabel}
      <span class="dot" style="display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--text-muted)"></span>
      ${article.date}
      <span class="dot" style="display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--text-muted)"></span>
      ${article.wordCount} words
    `;

    // Reset UI
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-ai-summary').style.display = 'none';
    document.getElementById('ai-summary').style.display = 'none';
    this._hideProgress();

    // Parse and render
    this._parseSentences(article.content);
    Translator.setArticle(article.id, this.sentences, article.translation || '');
    this._render();

    // Show reader page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('reader-page').classList.add('active');
    document.getElementById('app-title').textContent = jName;
    window.scrollTo(0, 0);

    // Show progress after render
    setTimeout(() => this._updateProgress(), 200);
  },

  _applySettings() {
    const root = document.documentElement;
    const fontMap = { system: 'var(--font-serif)', serif: '"Georgia", "Times New Roman", serif', dyslexic: '"OpenDyslexic", "Comic Sans MS", cursive' };
    root.style.setProperty('--reader-font', fontMap[Settings.get('fontFamily')] || 'var(--font-serif)');
    root.style.setProperty('--reader-font-size', Settings.get('fontSize') + 'px');
    root.style.setProperty('--reader-line-height', String(Settings.get('lineSpacing')));
    const widthMap = { narrow: '560px', medium: '680px', wide: '100%' };
    root.style.setProperty('--reader-width', widthMap[Settings.get('contentWidth')] || '680px');

    // Apply to article content
    const content = document.getElementById('article-content');
    if (content) {
      content.style.fontFamily = fontMap[Settings.get('fontFamily')] || 'var(--font-serif)';
      content.style.fontSize = Settings.get('fontSize') + 'px';
      content.style.lineHeight = String(Settings.get('lineSpacing'));
    }
    const page = document.querySelector('.reader-page');
    if (page) {
      page.style.maxWidth = widthMap[Settings.get('contentWidth')] || '680px';
    }

    // Progress display
    this._hideProgress();
    if (Settings.get('progressDisplay') !== 'hidden') {
      document.getElementById('reader-progress').style.display = '';
    }
  },

  _hideProgress() {
    document.getElementById('reader-progress').style.display = 'none';
  },

  _updateProgress() {
    const mode = Settings.get('progressDisplay');
    if (mode === 'hidden' || !this.article) return;

    const container = document.getElementById('article-content');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const winHeight = window.innerHeight;
    // Total scrollable distance: content height minus viewport height
    const maxScroll = Math.max(1, container.scrollHeight - winHeight);
    // How far the container top has scrolled above the viewport top
    const scrolled = Math.max(0, -rect.top);
    const pct = Math.min(100, Math.round((scrolled / maxScroll) * 100));

    document.getElementById('reader-progress').style.display = '';
    document.getElementById('reader-progress-fill').style.width = pct + '%';

    if (mode === 'percent') {
      document.getElementById('reader-progress-text').textContent = pct + '%';
    } else if (mode === 'time') {
      const wpm = 200; // avg reading speed
      const remaining = this.article.wordCount / wpm;
      const remainingNow = Math.max(1, Math.round(remaining * (1 - pct / 100)));
      const label = Settings.get('language') === 'zh' ? '剩余约 ' + remainingNow + ' 分钟' : '~' + remainingNow + ' min left';
      document.getElementById('reader-progress-text').textContent = label;
    }

    // Save resume-reading state (throttled by scroll events)
    if (this.article) {
      if (pct >= 100) {
        Profile.clearLastRead();
      } else if (pct > 0) {
        Profile.saveLastRead(this.article.id, pct);
      }
    }
  },

  _parseSentences(text) {
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    this.sentences = [];
    let idx = 0;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const para = paragraphs[pIdx];
      const raw = para.replace(/\n/g, ' ').trim();
      const parts = raw.match(/[^.!?]+(?:[.!?](?!\d)|$)/g) || [raw];
      for (let part of parts) {
        part = part.trim();
        if (!part) continue;
        if (!/[.!?]$/.test(part)) part += '.';
        this.sentences.push({ index: idx, text: part, paragraph: pIdx, zh: null });
        idx++;
      }
    }
  },

  _tokenize(sentence) {
    const tokens = [];
    const regex = /[a-zA-Z'-]+|[^a-zA-Z'-]+/g;
    let match;
    while ((match = regex.exec(sentence)) !== null) {
      tokens.push(match[0]);
    }
    return tokens;
  },

  _render() {
    const container = document.getElementById('article-content');
    const fragment = document.createDocumentFragment();
    const vocabHighlight = Settings.get('vocabHighlight') || Settings.get('vocabLevel') || Settings.get('examBank').length > 0;
    const clickAction = Settings.get('clickAction');

    let lastPara = -1;
    for (const s of this.sentences) {
      if (s.paragraph !== lastPara && lastPara >= 0) {
        const spacer = document.createElement('div');
        spacer.style.cssText = 'height:16px';
        fragment.appendChild(spacer);
      }
      lastPara = s.paragraph;

      const div = document.createElement('div');
      div.className = 'sentence-container';
      div.setAttribute('data-sentence-idx', s.index);

      const tokens = this._tokenize(s.text);
      for (const token of tokens) {
        if (/^[a-zA-Z'-]+$/.test(token) && token.length > 1) {
          const wordSpan = document.createElement('span');
          wordSpan.className = 'word-span';
          wordSpan.textContent = token;

          // Vocab highlighting
          if (vocabHighlight) {
            const labels = Settings.getWordLabels(token);
            if (labels.length > 0) {
              wordSpan.classList.add('vocab-word-highlight');
              // Add exam labels
              labels.forEach(label => {
                const lbl = document.createElement('span');
                lbl.className = 'vocab-label ' + label.toLowerCase();
                lbl.textContent = label;
                wordSpan.appendChild(lbl);
              });
            }
          }

          const word = token;
          if (clickAction === 'instant') {
            wordSpan.addEventListener('click', (e) => {
              e.stopPropagation();
              this.showWordPopup(word, e);
            });
          } else if (clickAction === 'select') {
            // Require double-click or selection
            wordSpan.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              this.showWordPopup(word, e);
            });
          }

          div.appendChild(wordSpan);
        } else {
          div.appendChild(document.createTextNode(token));
        }
      }
      fragment.appendChild(div);
    }

    container.innerHTML = '';
    container.appendChild(fragment);

    // Learn more link
    const learnMore = document.createElement('div');
    learnMore.style.cssText = 'margin-top:20px;text-align:center;font-size:12px;color:var(--text-muted);';
    learnMore.textContent = Settings.get('language') === 'zh'
      ? '💡 点击单词查释义 | 长按可选词后双击翻译'
      : '💡 Tap word for definition | Select + double-tap to translate';
    container.appendChild(learnMore);

    const ft = document.getElementById('full-translation-container');
    if (ft) ft.remove();
  },

  async showWordPopup(word, event) {
    this.currentWord = word;
    const dictType = Settings.get('dictionaryType');

    this.popupEl.innerHTML = `<div class="loading" style="padding:12px"><div class="spinner"></div> ${Settings.get('language')==='zh'?'查询中...':'Looking up...'}</div>`;
    this.popupEl.classList.add('visible');
    this._positionPopup(event);

    const result = await Dictionary.lookup(word);
    const isEnEn = dictType === 'enen';

    // Store for add-to-vocab button
    this._pendingVocab = {
      word: word,
      phonetic: result.phonetic || '',
      definition: (result.meanings && result.meanings.length > 0) ? result.meanings[0].definition : ''
    };

    let defsHtml = '';
    for (const m of (result.meanings || []).slice(0, 4)) {
      if (isEnEn && m.pos === 'zh') continue; // skip Chinese in English-only mode
      if (!isEnEn && m.pos !== 'zh' && result.meanings.some(x => x.pos === 'zh')) continue; // prefer Chinese if available
      const posLabel = m.pos && m.pos !== 'zh' ? `<span style="color:var(--text-muted);font-size:11px">${m.pos}</span> ` : '';
      defsHtml += `<div class="wp-def">${posLabel}${m.definition}</div>`;
    }

    if (!defsHtml) defsHtml = '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">' + (Settings.get('language')==='zh'?'未找到释义':'No definition') + '</div>';

    // Vocab labels
    const labels = Settings.getWordLabels(word);
    const labelsHtml = labels.length > 0
      ? `<div style="margin-bottom:6px">${labels.map(l => `<span class="vocab-label ${l.toLowerCase()}" style="font-size:10px;vertical-align:baseline">${l}</span>`).join(' ')}</div>`
      : '';

    this.popupEl.innerHTML = `
      <div class="wp-word">${result.word}</div>
      ${result.phonetic ? `<div class="wp-phonetic">/${result.phonetic}/</div>` : ''}
      ${labelsHtml}
      ${defsHtml ? `<div class="wp-definitions">${defsHtml}</div>` : ''}
      <div class="wp-actions">
        <button class="wp-btn" id="btn-speak">🔊 ${Settings.get('language')==='zh'?'朗读':'Speak'}</button>
        <button class="wp-btn wp-btn-add" id="btn-add-vocab">➕ ${Settings.get('language')==='zh'?'生词本':'Vocab'}</button>
      </div>
    `;

    this._positionPopup(event);

    // Check if word already in vocab
    let inVocab = false;
    try {
      const vocab = JSON.parse(localStorage.getItem('el_vocab') || '[]');
      inVocab = vocab.some(w => w.word.toLowerCase() === word.toLowerCase());
    } catch(e) {}

    const btnAdd = document.getElementById('btn-add-vocab');
    if (inVocab) {
      btnAdd.innerHTML = '✅ ' + (Settings.get('language')==='zh'?'已添加':'Added');
      btnAdd.classList.add('added');
    }

    btnAdd.addEventListener('click', () => {
      if (btnAdd.classList.contains('added')) return;
      const v = this._pendingVocab;
      if (v) Profile.addVocab(v.word, v.phonetic, v.definition);
      btnAdd.innerHTML = '✅ ' + (Settings.get('language')==='zh'?'已添加':'Added');
      btnAdd.classList.add('added');
    });

    document.getElementById('btn-speak').addEventListener('click', async () => {
      const btn = document.getElementById('btn-speak');
      btn.classList.add('playing');
      btn.textContent = '🔊 ' + (Settings.get('language')==='zh'?'播放中...':'Playing...');
      try { await Dictionary.speak(word); } catch(e) {}
      btn.classList.remove('playing');
      btn.textContent = '🔊 ' + (Settings.get('language')==='zh'?'朗读':'Speak');
    });
  },

  _positionPopup(event) {
    const popup = this.popupEl;
    const padding = 12;
    const isMobile = window.innerWidth < 768;
    let x, y;

    if (event.touches) {
      x = event.touches[0].clientX; y = event.touches[0].clientY;
    } else {
      x = event.clientX; y = event.clientY;
    }

    if (isMobile) {
      // On mobile: center at bottom of screen, easier to reach
      popup.style.left = '50%';
      popup.style.top = 'auto';
      popup.style.bottom = '80px';
      popup.style.transform = 'translateX(-50%)';
      popup.style.maxWidth = 'calc(100vw - 32px)';
    } else {
      // Desktop: position near the word
      popup.style.bottom = 'auto';
      popup.style.transform = '';
      const h = popup.offsetHeight || 150;
      y = y - h - 16;
      if (y < padding) y = (event.clientY || y + h + 16) + 24;
      x = x - 140;
      if (x < padding) x = padding;
      if (x + 300 > window.innerWidth - padding) x = window.innerWidth - 300 - padding;
      popup.style.left = x + 'px';
      popup.style.top = y + 'px';
    }
  },

  hidePopup() {
    if (this.popupEl) {
      this.popupEl.classList.remove('visible');
      this.currentWord = null;
    }
  },

  // ===== TRANSLATION TOGGLES =====

  async toggleSentenceTranslation() {
    this.state.sentenceTranslation = !this.state.sentenceTranslation;
    const btn = document.getElementById('btn-sentence-tr');
    const containers = document.querySelectorAll('.sentence-container');

    if (this.state.sentenceTranslation) {
      btn.classList.add('active');
      for (const container of containers) {
        const idx = parseInt(container.getAttribute('data-sentence-idx'));
        if (container.querySelector('.zh')) continue;

        const zhDiv = document.createElement('div');
        zhDiv.className = 'zh';
        zhDiv.textContent = '...';
        container.appendChild(zhDiv);

        const s = this.sentences[idx];
        if (s) {
          Translator.translateSentence(this.article.id, idx, s.text).then(zh => {
            if (zh && zh !== s.text) { zhDiv.textContent = zh; s.zh = zh; }
            else zhDiv.textContent = '';
          }).catch(() => { zhDiv.textContent = ''; });
        }
      }
    } else {
      btn.classList.remove('active');
      containers.forEach(c => { const zh = c.querySelector('.zh'); if (zh) zh.remove(); });
    }
  },

  async toggleFullTranslation() {
    this.state.fullTranslation = !this.state.fullTranslation;
    const btn = document.getElementById('btn-full-tr');

    if (this.state.fullTranslation) {
      btn.classList.add('active');
      if (this.state.sentenceTranslation) this.toggleSentenceTranslation();

      let ft = document.getElementById('full-translation-container');
      if (ft) { ft.style.display = ''; return; }

      ft = document.createElement('div');
      ft.id = 'full-translation-container';
      ft.className = 'full-translation';
      ft.innerHTML = `<div class="ft-title">📝 ${Settings.get('language')==='zh'?'全文翻译':'Full Translation'}</div><div class="loading"><div class="spinner"></div> ${Settings.get('language')==='zh'?'翻译中...':'Translating...'}</div>`;
      document.getElementById('article-content').appendChild(ft);

      const paragraphs = this.article.content.split('\n\n').filter(p => p.trim());
      Translator.translateFull(this.article.id, paragraphs).then(zh => {
        let parasHtml = '';
        if (zh) {
          parasHtml = zh.split('\n\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
        } else {
          const pre = this.article.translation || '';
          parasHtml = pre.split('\n\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
        }
        ft.innerHTML = `<div class="ft-title">📝 ${Settings.get('language')==='zh'?'全文翻译':'Full Translation'}</div>${parasHtml}`;
      }).catch(() => {
        const pre = this.article.translation || '';
        ft.innerHTML = `<div class="ft-title">📝 ${Settings.get('language')==='zh'?'全文翻译':'Full Translation'}</div>${pre.split('\n\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('')}`;
      });
    } else {
      btn.classList.remove('active');
      const ft = document.getElementById('full-translation-container');
      if (ft) ft.style.display = 'none';
    }
  },

  toggleAISummary() {
    this.state.aiSummary = !this.state.aiSummary;
    if (this.state.aiSummary) {
      document.getElementById('ai-summary').style.display = '';
      document.getElementById('ai-summary').innerHTML = `
        <div class="ai-summary-title">🤖 ${Settings.get('language')==='zh'?'AI 要点':'AI Key Points'}</div>
        <div style="font-size:13px;color:var(--text-muted)">${Settings.get('language')==='zh'?'需要配置 AI API Key 才能使用此功能':'AI API key required for this feature'}</div>
      `;
    } else {
      document.getElementById('ai-summary').style.display = 'none';
    }
  },

  // ===== FULL ARTICLE TEXT-TO-SPEECH =====
  _readState: { active: false, paused: false, currentIdx: -1, utterance: null },

  toggleReadAloud() {
    if (!this._readState.active) {
      this._startReading();
    } else if (this._readState.paused) {
      this._resumeReading();
    } else {
      this._pauseReading();
    }
  },

  _startReading() {
    if (!this.sentences || this.sentences.length === 0) return;

    const btn = document.getElementById('btn-read-aloud');
    btn.classList.add('active');
    const label = Settings.get('language') === 'zh' ? '⏸ 暂停' : '⏸ Pause';
    btn.innerHTML = label;

    this._readState = { active: true, paused: false, currentIdx: -1, utterance: null };
    this._readNext();
  },

  async _readNext() {
    if (!this._readState.active) return;
    if (this._readState.paused) return;

    this._readState.currentIdx++;
    if (this._readState.currentIdx >= this.sentences.length) {
      this._stopReading();
      return;
    }

    const idx = this._readState.currentIdx;
    const sentence = this.sentences[idx];

    // Highlight current sentence
    this._highlightSentence(idx);

    // Use Google TTS for natural voice, with browser fallback built-in
    try {
      await TTS.speak(sentence.text);
    } catch(e) {
      // TTS failed silently, continue
    }

    // Advance to next sentence if still active and not paused
    if (this._readState.active && !this._readState.paused) {
      this._readNext();
    }
  },

  _highlightSentence(idx) {
    // Remove previous highlight
    document.querySelectorAll('.sentence-reading').forEach(el => el.classList.remove('sentence-reading'));

    // Find and highlight current sentence container
    const container = document.querySelector(`[data-sentence-idx="${idx}"]`);
    if (container) {
      container.classList.add('sentence-reading');
      // Smooth scroll to the sentence
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  _pauseReading() {
    if (!this._readState.active) return;
    this._readState.paused = true;
    TTS.stop();
    const btn = document.getElementById('btn-read-aloud');
    if (btn) btn.innerHTML = Settings.get('language') === 'zh' ? '▶ 继续' : '▶ Resume';
  },

  _resumeReading() {
    this._readState.paused = false;
    const btn = document.getElementById('btn-read-aloud');
    if (btn) btn.innerHTML = Settings.get('language') === 'zh' ? '⏸ 暂停' : '⏸ Pause';
    this._readNext();
  },

  _stopReading() {
    this._readState.active = false;
    this._readState.paused = false;
    TTS.stop();

    // Remove highlight
    try { document.querySelectorAll('.sentence-reading').forEach(el => el.classList.remove('sentence-reading')); } catch(e) {}

    const btn = document.getElementById('btn-read-aloud');
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = Settings.get('language') === 'zh' ? '🔊 全文朗读' : '🔊 Read Aloud';
    }

    this._readState.currentIdx = -1;
  },

  // ===== ARTICLE READ / BOOKMARK =====

  _loadArticleStates() {
    try {
      this._readArticles = JSON.parse(localStorage.getItem('el_read') || '[]');
      this._bookmarkedArticles = JSON.parse(localStorage.getItem('el_bookmark') || '[]');
    } catch(e) {
      this._readArticles = [];
      this._bookmarkedArticles = [];
    }
  },

  _updateActionButtons() {
    if (!this.article) return;
    const id = this.article.id;
    const btnRead = document.getElementById('btn-mark-read');
    const btnBookmark = document.getElementById('btn-bookmark');
    if (!btnRead || !btnBookmark) return;
    const isZh = Settings.get('language') === 'zh';

    if (this._readArticles.includes(id)) {
      btnRead.classList.add('active');
      btnRead.innerHTML = '✅ <span>' + (isZh ? '已读' : 'Read') + '</span>';
    } else {
      btnRead.classList.remove('active');
      btnRead.innerHTML = '✅ <span>' + (isZh ? '标记已读' : 'Mark Read') + '</span>';
    }

    if (this._bookmarkedArticles.includes(id)) {
      btnBookmark.classList.add('active');
      btnBookmark.innerHTML = '⭐ <span>' + (isZh ? '已收藏' : 'Bookmarked') + '</span>';
    } else {
      btnBookmark.classList.remove('active');
      btnBookmark.innerHTML = '🔖 <span>' + (isZh ? '收藏' : 'Bookmark') + '</span>';
    }
  },

  toggleRead() {
    if (!this.article) return;
    const id = this.article.id;
    const idx = this._readArticles.indexOf(id);
    if (idx >= 0) {
      this._readArticles.splice(idx, 1);
    } else {
      this._readArticles.push(id);
      // Clear resume state when explicitly marked as read
      Profile.clearLastRead();
    }
    try { localStorage.setItem('el_read', JSON.stringify(this._readArticles)); } catch(e) {}
    this._updateActionButtons();
  },

  toggleBookmark() {
    if (!this.article) return;
    const id = this.article.id;
    const idx = this._bookmarkedArticles.indexOf(id);
    if (idx >= 0) {
      this._bookmarkedArticles.splice(idx, 1);
    } else {
      this._bookmarkedArticles.push(id);
    }
    try { localStorage.setItem('el_bookmark', JSON.stringify(this._bookmarkedArticles)); } catch(e) {}
    this._updateActionButtons();
    const isZh = Settings.get('language') === 'zh';
    App.toast(this._bookmarkedArticles.includes(id)
      ? (isZh ? '已收藏 ⭐' : 'Bookmarked ⭐')
      : (isZh ? '已取消收藏' : 'Removed bookmark'));
  }

};
