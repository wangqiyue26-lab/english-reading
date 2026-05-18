/* ============================================
   Reader Module — Reading, Focus Mode,
   Speed Tracking, Notes & Highlighting,
   Enhanced TTS, Keyboard Shortcuts
   ============================================ */

const Reader = {
  article: null,
  sentences: [],
  currentWord: null,
  popupEl: null,
  progressTimer: null,
  _readArticles: [],
  _bookmarkedArticles: [],
  _notes: {},        // { articleId: [{ id, text, note, color, timestamp }] }
  _startTime: null,  // For speed tracking
  _ttsSpeed: 1,
  _focusSession: { active: false, startTime: null, duration: 25, timerId: null, elapsed: 0 },
  state: {
    sentenceTranslation: false,
    fullTranslation: false,
    aiSummary: false
  },

  init() {
    this.popupEl = document.getElementById('word-popup');
    this._loadArticleStates();
    this._loadNotes();
    this._bindEvents();
  },

  _bindEvents() {
    document.addEventListener('click', (e) => {
      if (this.popupEl && !this.popupEl.contains(e.target) && !e.target.closest('.word-span')) {
        this.hidePopup();
      }
    });

    document.addEventListener('scroll', () => this._updateProgress(), { passive: true });

    // Text selection for highlighting
    document.addEventListener('mouseup', () => this._onTextSelect());
    document.addEventListener('touchend', () => {
      setTimeout(() => this._onTextSelect(), 100);
    });
  },

  _loadNotes() {
    try {
      this._notes = Sync.get('el_notes') || {};
    } catch(e) {
      this._notes = {};
    }
  },

  _saveNotes() {
    try { Sync.set('el_notes', this._notes); } catch(e) {}
  },

  // ===== OPEN ARTICLE =====
  async open(article) {
    this._stopReading();

    this.article = article;
    this.sentences = [];
    this.state.sentenceTranslation = false;
    this.state.fullTranslation = false;
    this.state.aiSummary = false;
    this._startTime = Date.now();

    this._updateActionButtons();
    this._applySettings();

    const jName = Settings.get('language') === 'zh' ? (article.journalZh || article.journal) : (article.journalEn || article.journal);
    document.getElementById('reader-journal').textContent = jName;
    document.getElementById('reader-title').textContent = article.title;
    const wpm = 200;
    const readTime = Math.max(1, Math.round(article.wordCount / wpm));
    document.getElementById('reader-meta').innerHTML =
      '<span class="ac-difficulty-tag ' + article.difficulty + '">' + article.difficultyLabel + '</span>' +
      '<span style="margin:0 6px;color:var(--text-muted)">·</span>' +
      article.date +
      '<span style="margin:0 6px;color:var(--text-muted)">·</span>' +
      article.wordCount + ' words' +
      '<span style="margin:0 6px;color:var(--text-muted)">·</span>' +
      '~' + readTime + ' min';

    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-ai-summary').style.display = 'none';
    document.getElementById('ai-summary').style.display = 'none';
    document.getElementById('speed-display').style.display = 'none';
    this._hideProgress();

    this._parseSentences(article.content);
    Translator.setArticle(article.id, this.sentences, article.translation || '');
    this._render();

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('reader-page').classList.add('active');
    document.getElementById('app-title').textContent = jName;
    window.scrollTo(0, 0);

    setTimeout(() => this._updateProgress(), 200);

    // Render notes for this article
    this._renderNotes();
  },

  _applySettings() {
    const root = document.documentElement;
    const fontMap = { system: 'var(--font-body)', serif: '"Georgia", "Times New Roman", serif', dyslexic: '"OpenDyslexic", "Comic Sans MS", cursive' };
    root.style.setProperty('--reader-font', fontMap[Settings.get('fontFamily')] || 'var(--font-body)');
    root.style.setProperty('--reader-font-size', Settings.get('fontSize') + 'px');
    root.style.setProperty('--reader-line-height', String(Settings.get('lineSpacing')));
    const widthMap = { narrow: '560px', medium: '680px', wide: '100%' };
    root.style.setProperty('--reader-width', widthMap[Settings.get('contentWidth')] || '680px');

    const content = document.getElementById('article-content');
    if (content) {
      content.style.fontSize = Settings.get('fontSize') + 'px';
      content.style.lineHeight = String(Settings.get('lineSpacing'));
    }
    const page = document.querySelector('.reader-page');
    if (page) {
      page.style.maxWidth = widthMap[Settings.get('contentWidth')] || '680px';
    }

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
    const maxScroll = Math.max(1, container.scrollHeight - winHeight);
    const scrolled = Math.max(0, -rect.top);
    const pct = Math.min(100, Math.round((scrolled / maxScroll) * 100));

    document.getElementById('reader-progress').style.display = '';
    document.getElementById('reader-progress-fill').style.width = pct + '%';

    if (mode === 'percent') {
      document.getElementById('reader-progress-text').textContent = pct + '%';
    } else if (mode === 'time') {
      const wpm = 200;
      const remaining = Math.max(1, Math.round((this.article.wordCount / wpm) * (1 - pct / 100)));
      const label = Settings.get('language') === 'zh' ? '剩余约 ' + remaining + ' 分钟' : '~' + remaining + ' min left';
      document.getElementById('reader-progress-text').textContent = label;
    }

    if (this.article) {
      if (pct >= 100) {
        Profile.clearLastRead();
        this._showSpeed();
      } else if (pct > 0) {
        Profile.saveLastRead(this.article.id, pct);
      }
    }
  },

  _showSpeed() {
    if (!this._startTime || !this.article) return;
    const elapsedMin = (Date.now() - this._startTime) / 60000;
    if (elapsedMin < 0.5) return;
    const wpm = Math.round(this.article.wordCount / elapsedMin);
    const display = document.getElementById('speed-display');
    const isZh = Settings.get('language') === 'zh';
    document.getElementById('speed-text').textContent = isZh
      ? '你的阅读速度：' + wpm + ' 词/分钟 · 用时 ' + Math.round(elapsedMin) + ' 分钟'
      : 'Your reading speed: ' + wpm + ' wpm · ' + Math.round(elapsedMin) + ' min';
    display.style.display = '';

    // Save to stats
    try {
      const today = new Date().toISOString().slice(0, 10);
      let speeds = Sync.get('el_reading_speeds') || {};
      if (!speeds[today]) speeds[today] = [];
      speeds[today].push({ articleId: this.article.id, wpm, elapsedMin });
      Sync.set('el_reading_speeds', speeds);
    } catch(e) {}
  },

  // ===== PARSE & RENDER =====
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

          if (vocabHighlight) {
            const labels = Settings.getWordLabels(token);
            if (labels.length > 0) {
              wordSpan.classList.add('vocab-word-highlight');
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

    // Apply existing highlights for this article
    this._applyHighlights();

    const learnMore = document.createElement('div');
    learnMore.style.cssText = 'margin-top:20px;text-align:center;font-size:12px;color:var(--text-muted);';
    learnMore.textContent = Settings.get('language') === 'zh'
      ? '💡 点击单词查释义 | 选中文字可添加笔记 ✏️'
      : '💡 Tap word for definition | Select text to add notes ✏️';
    container.appendChild(learnMore);

    const ft = document.getElementById('full-translation-container');
    if (ft) ft.remove();
  },

  // ===== NOTES & HIGHLIGHTING =====
  _onTextSelect() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length < 3) return;

    // Check if inside article content
    const container = document.getElementById('article-content');
    if (!container || !container.contains(selection.anchorNode)) return;

    // Show a small note prompt
    this._showNotePrompt(selectedText, selection);
  },

  _showNotePrompt(text, selection) {
    // Remove existing prompt
    const existing = document.getElementById('note-prompt');
    if (existing) existing.remove();

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const prompt = document.createElement('div');
    prompt.id = 'note-prompt';
    prompt.style.cssText =
      'position:fixed;z-index:1900;background:var(--bg-card);border:1px solid var(--accent);' +
      'border-radius:var(--radius-md);padding:8px 12px;box-shadow:var(--shadow-lg);' +
      'display:flex;gap:6px;align-items:center;font-size:13px;';
    prompt.style.top = (rect.top - 50) + 'px';
    prompt.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';

    const colors = ['#ffeb3b', '#a5d6a7', '#90caf9', '#f48fb1', '#ffcc80'];
    const colorBtns = colors.map(c =>
      '<span style="width:16px;height:16px;border-radius:50%;background:' + c +
      ';cursor:pointer;border:2px solid transparent;display:inline-block;" ' +
      'onclick="Reader._addHighlight(\'' + this._escapeJs(text) + '\',\'' + c + '\',event)"></span>'
    ).join('');

    const isZh = Settings.get('language') === 'zh';
    prompt.innerHTML =
      colorBtns +
      '<span style="color:var(--text-muted);margin:0 4px;">|</span>' +
      '<button style="background:var(--accent);color:#fff;border:none;padding:4px 10px;border-radius:12px;cursor:pointer;font-size:12px;" ' +
      'onclick="Reader._addNotePrompt(\'' + this._escapeJs(text) + '\',event)">' +
      (isZh ? '笔记' : 'Note') +
      '</button>' +
      '<button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:2px 4px;" ' +
      'onclick="document.getElementById(\'note-prompt\').remove()">✕</button>';

    document.body.appendChild(prompt);

    // Auto-remove after 8 seconds
    setTimeout(() => { const p = document.getElementById('note-prompt'); if (p) p.remove(); }, 8000);
  },

  _escapeJs(s) {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  },

  _addHighlight(text, color, event) {
    event && event.stopPropagation();
    if (!this.article) return;

    const articleId = this.article.id;
    if (!this._notes[articleId]) this._notes[articleId] = [];

    this._notes[articleId].push({
      id: Date.now().toString(36),
      text: text,
      note: '',
      color: color,
      timestamp: new Date().toISOString()
    });
    this._saveNotes();

    // Remove prompt
    const prompt = document.getElementById('note-prompt');
    if (prompt) prompt.remove();

    // Re-render to show highlight
    this._applyHighlights();
    this._renderNotes();

    const isZh = Settings.get('language') === 'zh';
    App.toast(isZh ? '已高亮 ✨' : 'Highlighted ✨');
  },

  _addNotePrompt(text, event) {
    event && event.stopPropagation();
    const prompt = document.getElementById('note-prompt');
    const isZh = Settings.get('language') === 'zh';

    if (prompt) {
      prompt.innerHTML =
        '<textarea id="note-textarea" style="min-width:180px;min-height:50px;padding:8px;border-radius:8px;border:1px solid var(--border);font-size:13px;resize:vertical;font-family:var(--font-ui);" ' +
        'placeholder="' + (isZh ? '写点笔记...' : 'Write a note...') + '"></textarea>' +
        '<button style="background:var(--accent);color:#fff;border:none;padding:4px 12px;border-radius:12px;cursor:pointer;font-size:12px;" ' +
        'onclick="Reader._saveNote(\'' + this._escapeJs(text) + '\')">' +
        (isZh ? '保存' : 'Save') +
        '</button>' +
        '<button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;" ' +
        'onclick="document.getElementById(\'note-prompt\').remove()">✕</button>';
    }
  },

  _saveNote(text) {
    if (!this.article) return;
    const noteText = document.getElementById('note-textarea')?.value?.trim();
    if (!noteText) return;

    const articleId = this.article.id;
    if (!this._notes[articleId]) this._notes[articleId] = [];

    this._notes[articleId].push({
      id: Date.now().toString(36),
      text: text,
      note: noteText,
      color: '#ffeb3b',
      timestamp: new Date().toISOString()
    });
    this._saveNotes();

    const prompt = document.getElementById('note-prompt');
    if (prompt) prompt.remove();

    this._applyHighlights();
    this._renderNotes();

    const isZh = Settings.get('language') === 'zh';
    App.toast(isZh ? '笔记已保存 📝' : 'Note saved 📝');
  },

  _applyHighlights() {
    if (!this.article) return;
    const articleId = this.article.id;
    const notes = this._notes[articleId];
    if (!notes || notes.length === 0) return;

    const container = document.getElementById('article-content');
    if (!container) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const note of notes) {
      for (const node of textNodes) {
        const idx = node.textContent.indexOf(note.text);
        if (idx >= 0) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + note.text.length);
          const span = document.createElement('span');
          span.className = 'user-highlight' + (note.note ? ' has-note' : '');
          span.style.background = note.color;
          span.title = note.note || note.text;
          span.setAttribute('data-note-id', note.id);
          try { range.surroundContents(span); } catch(e) {}
          break;
        }
      }
    }
  },

  _renderNotes() {
    const panel = document.getElementById('notes-panel');
    const list = document.getElementById('notes-list');
    if (!this.article || !panel || !list) return;

    const articleId = this.article.id;
    const notes = this._notes[articleId];
    if (!notes || notes.length === 0) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = '';
    const isZh = Settings.get('language') === 'zh';
    list.innerHTML = notes.slice().reverse().map(n =>
      '<div class="note-item">' +
        '<div class="ni-quote">' + this._escapeHtml(n.text) + '</div>' +
        (n.note ? '<div class="ni-text">' + this._escapeHtml(n.note) + '</div>' : '') +
        '<div class="ni-meta">' +
          '<span>' + new Date(n.timestamp).toLocaleDateString() + '</span>' +
          '<button class="ni-delete" onclick="Reader._deleteNote(\'' + n.id + '\')">' +
            (isZh ? '删除' : 'Delete') +
          '</button>' +
        '</div>' +
      '</div>'
    ).join('');

    const exportBtn = document.getElementById('btn-export-notes');
    if (exportBtn) exportBtn.style.display = notes.length > 0 ? '' : 'none';
  },

  _deleteNote(noteId) {
    if (!this.article) return;
    const articleId = this.article.id;
    this._notes[articleId] = (this._notes[articleId] || []).filter(n => n.id !== noteId);
    this._saveNotes();
    this._render();
    this._renderNotes();
  },

  exportNotes() {
    if (!this.article) return;
    const articleId = this.article.id;
    const notes = this._notes[articleId] || [];
    if (notes.length === 0) return;

    let md = '# Notes: ' + this.article.title + '\n\n';
    notes.forEach((n, i) => {
      md += '**' + (i + 1) + '.** "' + n.text + '"\n';
      if (n.note) md += '  > ' + n.note + '\n';
      md += '\n';
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notes_' + this.article.id + '.md';
    a.click();
    URL.revokeObjectURL(url);

    const isZh = Settings.get('language') === 'zh';
    App.toast(isZh ? '笔记已导出 📤' : 'Notes exported 📤');
  },

  _escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // ===== WORD POPUP =====
  async showWordPopup(word, event) {
    this.currentWord = word;
    const dictType = Settings.get('dictionaryType');

    this.popupEl.innerHTML = '<div class="loading" style="padding:12px"><div class="spinner"></div> ' + (Settings.get('language')==='zh'?'查询中...':'Looking up...') + '</div>';
    this.popupEl.classList.add('visible');
    this._positionPopup(event);

    const result = await Dictionary.lookup(word);
    const isEnEn = dictType === 'enen';

    this._pendingVocab = {
      word: word,
      phonetic: result.phonetic || '',
      definition: (result.meanings && result.meanings.length > 0) ? result.meanings[0].definition : ''
    };

    let defsHtml = '';
    for (const m of (result.meanings || []).slice(0, 4)) {
      if (isEnEn && m.pos === 'zh') continue;
      if (!isEnEn && m.pos !== 'zh' && result.meanings.some(x => x.pos === 'zh')) continue;
      const posLabel = m.pos && m.pos !== 'zh' ? '<span style="color:var(--text-muted);font-size:11px">' + m.pos + '</span> ' : '';
      defsHtml += '<div class="wp-def">' + posLabel + m.definition + '</div>';
    }

    if (!defsHtml) defsHtml = '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">' + (Settings.get('language')==='zh'?'未找到释义':'No definition') + '</div>';

    const labels = Settings.getWordLabels(word);
    const labelsHtml = labels.length > 0
      ? '<div style="margin-bottom:6px">' + labels.map(l => '<span class="vocab-label ' + l.toLowerCase() + '" style="font-size:10px;vertical-align:baseline">' + l + '</span>').join(' ') + '</div>'
      : '';

    this.popupEl.innerHTML =
      '<div class="wp-word">' + result.word + '</div>' +
      (result.phonetic ? '<div class="wp-phonetic">/' + result.phonetic + '/</div>' : '') +
      labelsHtml +
      (defsHtml ? '<div class="wp-definitions">' + defsHtml + '</div>' : '') +
      '<div class="wp-actions">' +
        '<button class="wp-btn" id="btn-speak">🔊 ' + (Settings.get('language')==='zh'?'朗读':'Speak') + '</button>' +
        '<button class="wp-btn wp-btn-add" id="btn-add-vocab">➕ ' + (Settings.get('language')==='zh'?'生词本':'Vocab') + '</button>' +
      '</div>';

    this._positionPopup(event);

    let inVocab = false;
    try {
      const vocab = Sync.get('el_vocab') || [];
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

    if (event.touches && event.touches.length > 0) {
      x = event.touches[0].clientX; y = event.touches[0].clientY;
    } else {
      x = event.clientX; y = event.clientY;
    }

    if (isMobile) {
      popup.style.left = '50%';
      popup.style.top = 'auto';
      popup.style.bottom = '80px';
      popup.style.transform = 'translateX(-50%)';
      popup.style.maxWidth = 'calc(100vw - 32px)';
    } else {
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
        zhDiv.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';

        const textSpan = document.createElement('span');
        textSpan.style.cssText = 'flex:1';
        textSpan.textContent = '...';
        zhDiv.appendChild(textSpan);

        // 小喇叭按钮
        const speakerBtn = document.createElement('button');
        speakerBtn.className = 'sentence-speaker-btn';
        speakerBtn.title = Settings.get('language') === 'zh' ? '朗读本句' : 'Read this sentence';
        speakerBtn.innerHTML = '🔊';
        speakerBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          Reader.speakSingleSentence(idx);
        });
        zhDiv.appendChild(speakerBtn);

        container.appendChild(zhDiv);

        const s = this.sentences[idx];
        if (s) {
          Translator.translateSentence(this.article.id, idx, s.text).then(zh => {
            if (zh && zh !== s.text) { textSpan.textContent = zh; s.zh = zh; }
            else textSpan.textContent = '';
          }).catch(() => { textSpan.textContent = ''; });
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
      ft.innerHTML = '<div class="ft-title">📝 ' + (Settings.get('language')==='zh'?'全文翻译':'Full Translation') + '</div><div class="loading"><div class="spinner"></div> ' + (Settings.get('language')==='zh'?'翻译中...':'Translating...') + '</div>';
      document.getElementById('article-content').appendChild(ft);

      const paragraphs = this.article.content.split('\n\n').filter(p => p.trim());
      Translator.translateFull(this.article.id, paragraphs).then(zh => {
        let parasHtml = '';
        if (zh) {
          parasHtml = zh.split('\n\n').filter(p => p.trim()).map(p => '<p>' + p + '</p>').join('');
        } else {
          const pre = this.article.translation || '';
          parasHtml = pre.split('\n\n').filter(p => p.trim()).map(p => '<p>' + p + '</p>').join('');
        }
        ft.innerHTML = '<div class="ft-title">📝 ' + (Settings.get('language')==='zh'?'全文翻译':'Full Translation') + '</div>' + parasHtml;
      }).catch(() => {
        const pre = this.article.translation || '';
        ft.innerHTML = '<div class="ft-title">📝 ' + (Settings.get('language')==='zh'?'全文翻译':'Full Translation') + '</div>' + pre.split('\n\n').filter(p => p.trim()).map(p => '<p>' + p + '</p>').join('');
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
      document.getElementById('ai-summary').innerHTML =
        '<div class="ai-summary-title">🤖 ' + (Settings.get('language')==='zh'?'AI 要点':'AI Key Points') + '</div>' +
        '<div style="font-size:13px;color:var(--text-muted)">' + (Settings.get('language')==='zh'?'需要配置 AI API Key 才能使用此功能':'AI API key required for this feature') + '</div>';
    } else {
      document.getElementById('ai-summary').style.display = 'none';
    }
  },

  // ===== FOCUS MODE =====
  toggleFocusMode() {
    if (this._focusSession.active) {
      this.exitFocusMode();
      return;
    }
    this._startFocusMode();
  },

  _startFocusMode() {
    const overlay = document.getElementById('focus-overlay');
    overlay.classList.add('open');
    this._focusSession.active = true;
    this._focusSession.startTime = Date.now();
    this._focusSession.elapsed = 0;
    this._focusSession.duration = 25; // 25 min default

    // Pause TTS if active
    if (this._readState.active) this._pauseReading();

    this._updateFocusDisplay();
    this._focusSession.timerId = setInterval(() => {
      this._focusSession.elapsed = Math.floor((Date.now() - this._focusSession.startTime) / 1000);
      this._updateFocusDisplay();
      if (this._focusSession.elapsed >= this._focusSession.duration * 60) {
        this._focusComplete();
      }
    }, 1000);

    document.getElementById('btn-focus-mode').classList.add('active');
  },

  _updateFocusDisplay() {
    const remaining = Math.max(0, this._focusSession.duration * 60 - this._focusSession.elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    document.getElementById('focus-time').textContent = mins + ':' + String(secs).padStart(2, '0');

    const totalSecs = this._focusSession.duration * 60;
    const progress = this._focusSession.elapsed / totalSecs;
    const circumference = 339.292;
    document.getElementById('focus-ring-progress').style.strokeDashoffset = circumference * (1 - Math.min(1, progress));

    document.getElementById('focus-label').textContent = this._focusSession.elapsed > 0
      ? (Settings.get('language') === 'zh' ? '保持专注...' : 'Stay focused...')
      : (Settings.get('language') === 'zh' ? '专注阅读开始' : 'Focus session started');
  },

  _focusComplete() {
    clearInterval(this._focusSession.timerId);
    this._focusSession.active = false;

    // Save focus session
    try {
      let sessions = Sync.get('el_focus_sessions') || [];
      sessions.push({
        date: new Date().toISOString(),
        duration: this._focusSession.duration,
        articleId: this.article?.id || null
      });
      if (sessions.length > 100) sessions = sessions.slice(-100);
      Sync.set('el_focus_sessions', sessions);
    } catch(e) {}

    document.getElementById('focus-overlay').classList.remove('open');
    document.getElementById('btn-focus-mode').classList.remove('active');

    const isZh = Settings.get('language') === 'zh';
    App.toast(isZh ? '专注完成！做得很好 🎉' : 'Focus session complete! Well done 🎉', 3000);
  },

  exitFocusMode() {
    clearInterval(this._focusSession.timerId);
    this._focusSession.active = false;

    // Save partial session if > 1 min
    if (this._focusSession.elapsed > 60) {
      try {
        let sessions = Sync.get('el_focus_sessions') || [];
        sessions.push({
          date: new Date().toISOString(),
          duration: Math.round(this._focusSession.elapsed / 60),
          articleId: this.article?.id || null,
          partial: true
        });
        if (sessions.length > 100) sessions = sessions.slice(-100);
        Sync.set('el_focus_sessions', sessions);
      } catch(e) {}
    }

    document.getElementById('focus-overlay').classList.remove('open');
    document.getElementById('btn-focus-mode').classList.remove('active');
  },

  setFocusDuration(mins) {
    this._focusSession.duration = mins;
    if (this._focusSession.active) {
      this._focusSession.startTime = Date.now();
      this._focusSession.elapsed = 0;
      this._updateFocusDisplay();
    }
  },

  // ===== TTS WITH SPEED CONTROL =====
  _readState: { active: false, paused: false, currentIdx: -1, utterance: null },

  setTTSSpeed(speed) {
    this._ttsSpeed = speed;
    document.querySelectorAll('.tts-speed-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector('.tts-speed-btn[data-speed="' + speed + '"]');
    if (btn) btn.classList.add('active');
    // Show speed bar
    document.getElementById('tts-speed-bar').style.display = 'flex';
  },

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
    btn.innerHTML = Settings.get('language') === 'zh' ? '⏸ 暂停' : '⏸ Pause';

    document.getElementById('tts-speed-bar').style.display = 'flex';

    this._readState = { active: true, paused: false, currentIdx: 0, utterance: null };
    this._playCurrentSentence();
  },

  /** 播放当前句子，完成后自动播下一句 */
  async _playCurrentSentence() {
    if (!this._readState.active) return;
    if (this._readState.paused) return;

    const idx = this._readState.currentIdx;
    if (idx >= this.sentences.length) {
      this._stopReading();
      return;
    }

    const sentence = this.sentences[idx];
    this._highlightSentence(idx);

    try {
      await TTS.speak(sentence.text, this._ttsSpeed);
    } catch(e) {}

    // 当前句播放完，检查是否继续下一句
    if (this._readState.active && !this._readState.paused) {
      this._readState.currentIdx++;
      this._playCurrentSentence();
    }
  },

  _highlightSentence(idx) {
    document.querySelectorAll('.sentence-reading').forEach(el => el.classList.remove('sentence-reading'));
    const container = document.querySelector('[data-sentence-idx="' + idx + '"]');
    if (container) {
      container.classList.add('sentence-reading');
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
    if (!this._readState.active) return;
    this._readState.paused = false;
    const btn = document.getElementById('btn-read-aloud');
    if (btn) btn.innerHTML = Settings.get('language') === 'zh' ? '⏸ 暂停' : '⏸ Pause';
    // 重新播放当前句子，不再递增索引
    this._playCurrentSentence();
  },

  _stopReading() {
    this._readState.active = false;
    this._readState.paused = false;
    TTS.stop();

    try { document.querySelectorAll('.sentence-reading').forEach(el => el.classList.remove('sentence-reading')); } catch(e) {}

    const btn = document.getElementById('btn-read-aloud');
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = Settings.get('language') === 'zh' ? '🔊 全文朗读' : '🔊 Read Aloud';
    }
    document.getElementById('tts-speed-bar').style.display = 'none';

    this._readState.currentIdx = 0;
  },

  /** 朗读单句（逐句翻译小喇叭使用），不改变全文朗读状态 */
  async speakSingleSentence(idx) {
    const sentence = this.sentences[idx];
    if (!sentence) return;
    // 暂停全文朗读（如果正在进行）
    const wasReading = this._readState.active && !this._readState.paused;
    if (wasReading) this._pauseReading();

    this._highlightSentence(idx);
    try {
      await TTS.speak(sentence.text, this._ttsSpeed);
    } catch(e) {}

    // 恢复之前的全文朗读状态（用户需手动继续）
  },

  // ===== ARTICLE READ / BOOKMARK =====
  _loadArticleStates() {
    try {
      this._readArticles = Sync.get('el_read') || [];
      this._bookmarkedArticles = Sync.get('el_bookmark') || [];
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
      Profile.clearLastRead();
      this._showSpeed();
    }
    try { Sync.set('el_read', this._readArticles); } catch(e) {}
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
    try { Sync.set('el_bookmark', this._bookmarkedArticles); } catch(e) {}
    this._updateActionButtons();

    // Bounce animation
    const btn = document.getElementById('btn-bookmark');
    if (btn && this._bookmarkedArticles.includes(id)) {
      btn.classList.add('bookmark-animate');
      setTimeout(() => btn.classList.remove('bookmark-animate'), 400);
    }

    const isZh = Settings.get('language') === 'zh';
    App.toast(this._bookmarkedArticles.includes(id)
      ? (isZh ? '已收藏 ⭐' : 'Bookmarked ⭐')
      : (isZh ? '已取消收藏' : 'Removed bookmark'));
  }
};
