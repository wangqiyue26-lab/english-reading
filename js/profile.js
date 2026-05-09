/* ============================================
   Profile Module — Streak, Level, Heatmap,
   Resume, Vocab Analytics, Bookmarks, Reads
   ============================================ */

const Profile = {
  vocab: [],
  readIds: [],
  bookmarkIds: [],
  streakDates: [],
  dailyStats: {},
  lastRead: null,
  _vocabTab: 'all',
  _vocabFilterIdx: null, // index of word being viewed in popup

  /* Ebbinghaus review intervals (days after last review) */
  REVIEW_INTERVALS: [1, 2, 4, 7, 15, 30],

  /* Level system: { icon, i18nKey, minDays, maxDays } */
  LEVELS: [
    { icon: '🌱', key: 'level_0', min: 0, max: 6 },
    { icon: '📖', key: 'level_1', min: 7, max: 29 },
    { icon: '📚', key: 'level_2', min: 30, max: 99 },
    { icon: '✍️', key: 'level_3', min: 100, max: 199 },
    { icon: '🎓', key: 'level_4', min: 200, max: Infinity }
  ],

  init() {
    this._loadData();
  },

  _loadData() {
    try {
      this.vocab = JSON.parse(localStorage.getItem('el_vocab') || '[]');
      this.readIds = JSON.parse(localStorage.getItem('el_read') || '[]');
      this.bookmarkIds = JSON.parse(localStorage.getItem('el_bookmark') || '[]');
      this.streakDates = JSON.parse(localStorage.getItem('el_streak_dates') || '[]');
      this.dailyStats = JSON.parse(localStorage.getItem('el_daily_stats') || '{}');
      this.lastRead = JSON.parse(localStorage.getItem('el_last_read') || 'null');
      // Ensure vocab entries have reviews array
      this.vocab = this.vocab.map(w => ({
        ...w,
        reviews: w.reviews || [],
        status: w.status || this._calcStatus(w)
      }));
    } catch(e) {
      this.vocab = []; this.readIds = []; this.bookmarkIds = [];
      this.streakDates = []; this.dailyStats = {}; this.lastRead = null;
    }
  },

  // ===== OPEN / RENDER =====

  open() {
    this._loadData();
    this._vocabTab = 'all';
    this.render();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('profile-page').classList.add('active');
    document.getElementById('app-title').textContent = Settings.t('profile_title');
    window.scrollTo(0, 0);
    App._updateBackButton();
  },

  render() {
    this._loadData();
    this._renderStreak();
    this._renderLevel();
    this._renderResume();
    this._renderReviewAlert();
    this._renderHeatmap();
    this._renderVocab();
    this._renderBookmarks();
    this._renderReads();
    this._updateHideReadToggle();
    this._applyLanguage();
    this._bindVocabTabs();
  },

  // ===== STREAK =====

  _renderStreak() {
    const today = new Date();
    const todayStr = this._dateStr(today);
    const yesterdayStr = this._dateStr(new Date(today - 86400000));
    const uniqueDates = [...new Set(this.streakDates)].sort().reverse();

    let streak = 0;
    let checkDate = uniqueDates.includes(todayStr) ? todayStr : yesterdayStr;
    if (!uniqueDates.includes(checkDate)) checkDate = uniqueDates[0] || '';
    if (checkDate) {
      let d = new Date(checkDate + 'T00:00:00');
      while (uniqueDates.includes(this._dateStr(d))) {
        streak++;
        d = new Date(d - 86400000);
      }
    }

    const total = uniqueDates.length;
    const monthPrefix = todayStr.slice(0, 7);
    const monthDays = uniqueDates.filter(d => d.startsWith(monthPrefix)).length;

    document.getElementById('streak-days').textContent = streak;
    document.getElementById('streak-total').textContent = total;
    document.getElementById('streak-month').textContent = monthDays + '/' + today.getDate();
  },

  // ===== LEVEL SYSTEM =====

  _getLevelInfo(days) {
    for (let i = this.LEVELS.length - 1; i >= 0; i--) {
      if (days >= this.LEVELS[i].min) return { ...this.LEVELS[i], idx: i };
    }
    return { ...this.LEVELS[0], idx: 0 };
  },

  _renderLevel() {
    const uniqueDates = [...new Set(this.streakDates)];
    const totalDays = uniqueDates.length;
    const info = this._getLevelInfo(totalDays);
    const nextLevel = this.LEVELS[info.idx + 1];

    document.getElementById('level-icon').textContent = info.icon;
    document.getElementById('level-name').textContent = Settings.t(info.key);

    if (nextLevel) {
      const progress = totalDays - info.min;
      const range = nextLevel.min - info.min;
      const pct = Math.min(100, Math.round((progress / range) * 100));
      document.getElementById('level-progress-fill').style.width = pct + '%';
      const remaining = nextLevel.min - totalDays;
      const nameLabel = Settings.t(nextLevel.key);
      document.getElementById('level-next').textContent =
        Settings.t('level_next').replace('{n}', remaining).replace('{name}', nameLabel);
      document.getElementById('level-bar-container').style.display = '';
    } else {
      document.getElementById('level-progress-fill').style.width = '100%';
      document.getElementById('level-next').textContent = '🏆 最高等级已达到';
      document.getElementById('level-bar-container').style.display = '';
    }
  },

  // ===== RESUME READING =====

  _renderResume() {
    const section = document.getElementById('resume-section');
    if (!this.lastRead || !this.lastRead.articleId) {
      section.style.display = 'none';
      return;
    }

    const article = Data.getById(this.lastRead.articleId);
    if (!article) { section.style.display = 'none'; return; }

    // Only hide if fully completed (100%)
    if (this.lastRead.progress >= 100) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    document.getElementById('resume-title').textContent = article.title;
    document.getElementById('resume-meta').textContent =
      article.journal + ' · ' + article.difficultyLabel;

    const pct = this.lastRead.progress || 0;
    document.getElementById('resume-progress-pie').style.background =
      'conic-gradient(var(--accent) ' + pct * 3.6 + 'deg, var(--border) 0deg)';
  },

  _resumeReading() {
    if (!this.lastRead || !this.lastRead.articleId) return;
    const article = Data.getById(this.lastRead.articleId);
    if (!article) return;
    Reader.open(article);
    App._updateBackButton();
    App._applyReaderStyles();
  },

  // ===== REVIEW ALERT (Ebbinghaus) =====

  _calcStatus(word) {
    if (!word.reviews || word.reviews.length === 0) return 'new';
    if (word.reviews.length >= this.REVIEW_INTERVALS.length) return 'mastered';
    const today = new Date();
    const todayStr = this._dateStr(today);
    const lastReview = new Date(word.reviews[word.reviews.length - 1] + 'T00:00:00');
    const daysSince = Math.floor((today - lastReview) / 86400000);
    const nextInterval = this.REVIEW_INTERVALS[word.reviews.length - 1] || this.REVIEW_INTERVALS[0];
    if (daysSince >= nextInterval) return 'review'; // due for review
    return 'reviewing';
  },

  _getDueReviews() {
    return this.vocab.filter(w => this._calcStatus(w) === 'review');
  },

  _renderReviewAlert() {
    const due = this._getDueReviews();
    const alert = document.getElementById('review-alert');
    if (due.length === 0) {
      alert.style.display = 'none';
      return;
    }
    alert.style.display = '';
    const text = Settings.t('review_due').replace('{n}', due.length);
    document.getElementById('review-alert-text').textContent = text;
  },

  _scrollToVocab() {
    this._vocabTab = 'review';
    this._renderVocab();
    this._bindVocabTabs();
    document.querySelectorAll('.vocab-tab').forEach(t => t.classList.remove('active'));
    const reviewTab = document.querySelector('.vocab-tab[data-tab="review"]');
    if (reviewTab) reviewTab.classList.add('active');
    document.getElementById('vocab-section').scrollIntoView({ behavior: 'smooth' });
  },

  // ===== HEATMAP =====

  _renderHeatmap() {
    const today = new Date();
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364); // past 365 days

    // Build data map
    const statsMap = {};
    for (const [date, data] of Object.entries(this.dailyStats)) {
      const words = typeof data === 'object' ? (data.words || 0) : data;
      statsMap[date] = words;
    }

    // Build columns (weeks)
    const cols = [];
    let current = new Date(startDate);
    // Align to Sunday
    const dayOfWeek = current.getDay();
    current.setDate(current.getDate() - dayOfWeek);

    const months = [];
    let lastMonth = -1;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    while (current <= endDate) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(current);
        date.setDate(date.getDate() + d);
        const dateStr = this._dateStr(date);
        if (date > endDate) {
          week.push({ date: dateStr, words: -1 }); // future
        } else if (date < startDate) {
          week.push({ date: dateStr, words: -1 });
        } else {
          const words = statsMap[dateStr] || 0;
          week.push({ date: dateStr, words: words });
          if (date.getMonth() !== lastMonth && d === 0) {
            lastMonth = date.getMonth();
            months.push({ idx: cols.length, label: monthNames[lastMonth] });
          }
        }
      }
      cols.push(week);
      current.setDate(current.getDate() + 7);
    }

    // Render months
    const monthsEl = document.getElementById('heatmap-months');
    monthsEl.innerHTML = months.map(m => '<span style="position:absolute;left:' + (m.idx * 16) + 'px">' + m.label + '</span>').join('');
    monthsEl.style.cssText = 'position:relative;height:14px;margin-left:14px;margin-bottom:2px;font-size:10px;color:var(--text-muted)';

    // Render grid
    const grid = document.getElementById('heatmap-grid');
    const maxWords = Math.max(1, ...Object.values(statsMap));
    grid.innerHTML = cols.map(col =>
      '<div class="heatmap-col">' +
      col.map(cell => {
        if (cell.words < 0) return '<div class="heatmap-cell" style="visibility:hidden"></div>';
        const level = this._heatmapLevel(cell.words, maxWords);
        const title = cell.date + ': ' + cell.words + ' words';
        return '<div class="heatmap-cell level-' + level + '" title="' + title + '"></div>';
      }).join('') +
      '</div>'
    ).join('');
  },

  _heatmapLevel(words, max) {
    if (words <= 0) return 0;
    const ratio = words / max;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  },

  // ===== VOCAB =====

  _bindVocabTabs() {
    document.querySelectorAll('.vocab-tab').forEach(tab => {
      tab.onclick = () => this._switchVocabTab(tab.getAttribute('data-tab'));
    });
  },

  _switchVocabTab(tab) {
    this._vocabTab = tab;
    document.querySelectorAll('.vocab-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector('.vocab-tab[data-tab="' + tab + '"]');
    if (activeTab) activeTab.classList.add('active');
    this._renderVocab();
  },

  _filterVocab() {
    let words = [...this.vocab].reverse();
    if (this._vocabTab === 'review') {
      words = words.filter(w => this._calcStatus(w) === 'review');
    } else if (this._vocabTab === 'mastered') {
      words = words.filter(w => this._calcStatus(w) === 'mastered');
    }
    return words;
  },

  _renderVocab() {
    const grid = document.getElementById('vocab-grid');
    const filtered = this._filterVocab();
    document.getElementById('vocab-count').textContent = filtered.length;

    if (filtered.length === 0) {
      const msgs = {
        all: Settings.get('language') === 'zh' ? '点击文章中的单词查词，再点➕加入生词本' : 'Tap a word, then ➕ to add it',
        review: Settings.get('language') === 'zh' ? '暂无待复习单词 🎉' : 'No words due for review 🎉',
        mastered: Settings.get('language') === 'zh' ? '还没有已掌握的单词' : 'No mastered words yet'
      };
      grid.innerHTML = '<div class="empty-hint">' + (msgs[this._vocabTab] || msgs.all) + '</div>';
      return;
    }

    grid.innerHTML = filtered.map((w, i) => {
      const realIdx = this.vocab.indexOf(w);
      const status = this._calcStatus(w);
      let statusDot = '';
      if (status === 'new') statusDot = '<span style="width:6px;height:6px;border-radius:50%;background:#f44336;flex-shrink:0" title="' + (Settings.get('language')==='zh'?'新学':'New') + '"></span>';
      else if (status === 'review') statusDot = '<span style="width:6px;height:6px;border-radius:50%;background:#ff9800;flex-shrink:0" title="' + (Settings.get('language')==='zh'?'待复习':'Review due') + '"></span>';
      else if (status === 'reviewing') statusDot = '<span style="width:6px;height:6px;border-radius:50%;background:#2196f3;flex-shrink:0" title="' + (Settings.get('language')==='zh'?'复习中':'Reviewing') + '"></span>';
      else statusDot = '<span style="width:6px;height:6px;border-radius:50%;background:#4caf50;flex-shrink:0" title="' + (Settings.get('language')==='zh'?'已掌握':'Mastered') + '"></span>';

      return '<span class="vocab-chip" onclick="Profile._onVocabClick(' + realIdx + ', event)" title="' +
        (w.definition || '') + '">' +
        statusDot +
        '<span>' + this._escape(w.word) + '</span>' +
        (w.phonetic ? '<span class="vocab-chip-phonetic">/' + this._escape(w.phonetic) + '/</span>' : '') +
        '<span class="vocab-chip-remove" onclick="Profile._removeVocab(' + realIdx + ', event)">✕</span>' +
        '</span>';
    }).join('');
  },

  _onVocabClick(idx, event) {
    event.stopPropagation();
    const word = this.vocab[idx];
    if (!word) return;
    // Mark as reviewed
    const today = this._dateStr(new Date());
    if (!word.reviews) word.reviews = [];
    if (!word.reviews.includes(today)) {
      word.reviews.push(today);
      word.status = this._calcStatus(word);
      try { localStorage.setItem('el_vocab', JSON.stringify(this.vocab)); } catch(e) {}
    }
    // Show word popup
    Reader.showWordPopup(word.word, event);
    // Re-render after short delay
    setTimeout(() => this._renderVocab(), 500);
  },

  _removeVocab(idx, event) {
    event.stopPropagation();
    event.preventDefault();
    this.vocab.splice(idx, 1);
    try { localStorage.setItem('el_vocab', JSON.stringify(this.vocab)); } catch(e) {}
    this._renderVocab();
  },

  // ===== BOOKMARKS =====

  _renderBookmarks() {
    const list = document.getElementById('profile-bookmark-list');
    document.getElementById('bookmark-count').textContent = this.bookmarkIds.length;
    if (this.bookmarkIds.length === 0) {
      list.innerHTML = '<div class="empty-hint" data-lang-key="bookmark_empty">' +
        (Settings.get('language') === 'zh' ? '还没有收藏文章' : 'No bookmarks yet') + '</div>';
      return;
    }
    const articles = this.bookmarkIds.map(id => Data.getById(id)).filter(Boolean);
    list.innerHTML = articles.map(a => this._articleCardHTML(a, '⭐')).join('');
  },

  // ===== READ ARTICLES =====

  _renderReads() {
    const list = document.getElementById('profile-read-list');
    document.getElementById('read-count').textContent = this.readIds.length;
    if (this.readIds.length === 0) {
      list.innerHTML = '<div class="empty-hint" data-lang-key="read_empty">' +
        (Settings.get('language') === 'zh' ? '还没有已读文章' : 'No articles read yet') + '</div>';
      return;
    }
    const articles = this.readIds.map(id => Data.getById(id)).filter(Boolean);
    list.innerHTML = articles.map(a => this._articleCardHTML(a, '✅')).join('');
  },

  // ===== HIDE READ =====

  toggleHideRead() {
    const current = Settings.get('hideRead');
    Settings.set('hideRead', !current);
    Settings.save();
    this._updateHideReadToggle();
    if (App && App.renderHome) App.renderHome();
  },

  _updateHideReadToggle() {
    const btn = document.getElementById('btn-hide-read');
    if (!btn) return;
    if (Settings.get('hideRead')) btn.classList.add('on');
    else btn.classList.remove('on');
  },

  // ===== DAILY STATS (called from app.js) =====

  recordRead(article) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let stats = JSON.parse(localStorage.getItem('el_daily_stats') || '{}');
      if (!stats[today]) stats[today] = { articles: 0, words: 0 };
      stats[today].articles = (stats[today].articles || 0) + 1;
      stats[today].words = (stats[today].words || 0) + (article.wordCount || 0);
      localStorage.setItem('el_daily_stats', JSON.stringify(stats));
    } catch(e) {}
  },

  saveLastRead(articleId, progress) {
    try {
      const data = { articleId, progress, timestamp: Date.now() };
      localStorage.setItem('el_last_read', JSON.stringify(data));
    } catch(e) {}
  },

  clearLastRead() {
    try { localStorage.removeItem('el_last_read'); } catch(e) {}
  },

  // ===== HELPERS =====

  _articleCardHTML(article, icon) {
    return '<div class="profile-article-card" onclick="Profile._openArticle(\'' + article.id + '\')">' +
      '<span class="pa-icon">' + icon + '</span>' +
      '<div class="pa-info">' +
        '<div class="pa-title">' + this._escape(article.title) + '</div>' +
        '<div class="pa-meta">' +
          article.journal + ' · ' + article.difficultyLabel + ' · ' + article.wordCount + ' words' +
        '</div>' +
      '</div>' +
    '</div>';
  },

  _openArticle(id) {
    const article = Data.getById(id);
    if (!article) return;
    Reader.open(article);
    App._markArticleRead();
    App._updateBackButton();
    App._applyReaderStyles();
  },

  _dateStr(d) {
    return d.toISOString().slice(0, 10);
  },

  _escape(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  _applyLanguage() {
    const lang = Settings.get('language');
    const map = Settings.i18n[lang] || Settings.i18n.zh;
    document.querySelectorAll('#profile-page [data-lang-key]').forEach(el => {
      const key = el.getAttribute('data-lang-key');
      if (map[key]) el.textContent = map[key];
    });
  }
};
