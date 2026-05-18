/* ============================================
   Profile Module — Streak, Level, Heatmap,
   Resume, Vocab Export, Weekly Reports,
   Bookmarks, Reads, Focus History
   ============================================ */

const Profile = {
  vocab: [],
  readIds: [],
  bookmarkIds: [],
  streakDates: [],
  dailyStats: {},
  lastRead: null,
  _vocabTab: 'all',

  REVIEW_INTERVALS: [1, 2, 4, 7, 15, 30],

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
      this.vocab = Sync.get('el_vocab') || [];
      this.readIds = Sync.get('el_read') || [];
      this.bookmarkIds = Sync.get('el_bookmark') || [];
      this.streakDates = Sync.get('el_streak_dates') || [];
      this.dailyStats = Sync.get('el_daily_stats') || {};
      this.lastRead = Sync.get('el_last_read');
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
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('profile-page').classList.add('active');
    document.getElementById('app-title').textContent = Settings.t('profile_title');
    window.scrollTo(0, 0);
    App._updateBackButton();
    this.render();
  },

  render() {
    this._loadData();
    const safe = (name, fn) => { try { fn(); } catch(e) { console.warn('Profile render failed:', name, e); } };
    safe('weeklyReport', () => this._renderWeeklyReport());
    safe('streak', () => this._renderStreak());
    safe('level', () => this._renderLevel());
    safe('resume', () => this._renderResume());
    safe('review', () => this._renderReviewAlert());
    safe('heatmap', () => this._renderHeatmap());
    safe('vocab', () => this._renderVocab());
    safe('bookmarks', () => this._renderBookmarks());
    safe('reads', () => this._renderReads());
    safe('hideRead', () => this._updateHideReadToggle());
    safe('focusHistory', () => this._renderFocusHistory());
    safe('account', () => this._renderAccount());
    safe('language', () => this._applyLanguage());
    safe('tabs', () => this._bindVocabTabs());
  },

  // ===== WEEKLY REPORT =====
  _renderWeeklyReport() {
    const section = document.getElementById('weekly-report');
    const isZh = Settings.get('language') === 'zh';

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    let totalArticles = 0, totalWords = 0;
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      weekDays.push(ds);
      const stat = this.dailyStats[ds];
      if (stat) {
        totalArticles += (stat.articles || 0);
        totalWords += (stat.words || 0);
      }
    }

    if (totalArticles === 0 && totalWords === 0) {
      // Check last week
      let lastWeekArticles = 0;
      for (let i = 7; i < 14; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        const stat = this.dailyStats[ds];
        if (stat) lastWeekArticles += (stat.articles || 0);
      }
      if (lastWeekArticles === 0) {
        section.style.display = 'none';
        return;
      }
    }

    section.style.display = '';
    document.getElementById('wr-articles').textContent = totalArticles;
    document.getElementById('wr-words').textContent = totalWords.toLocaleString();

    // Estimate minutes: ~200 wpm
    const totalMins = Math.round(totalWords / 200);
    document.getElementById('wr-minutes').textContent = totalMins || '0';

    // Tip
    let tip = isZh
      ? '新的一周开始了，继续保持阅读习惯！📚'
      : 'A new week begins — keep up your reading habit! 📚';
    if (totalArticles >= 5) {
      tip = isZh
        ? '太棒了！你这周的阅读量很不错，继续保持！🌟'
        : 'Great job! You had a solid reading week, keep it up! 🌟';
    } else if (totalArticles >= 3) {
      tip = isZh
        ? '不错！你的阅读习惯正在养成中，再坚持一下 💪'
        : 'Nice work! Your reading habit is building up 💪';
    } else if (totalArticles > 0) {
      tip = isZh
        ? '开始总是最难的，你已经迈出了第一步！明天多读一篇吧 🚀'
        : 'Starting is the hardest part — you\'ve begun! Try one more tomorrow 🚀';
    }

    // Check speed trend
    try {
      const speeds = Sync.get('el_reading_speeds') || {};
      let recentSpeeds = [];
      for (const ds of weekDays) {
        const daySpeeds = speeds[ds];
        if (daySpeeds) recentSpeeds = recentSpeeds.concat(daySpeeds.map(s => s.wpm));
      }
      if (recentSpeeds.length >= 2) {
        const avgWpm = Math.round(recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length);
        tip += isZh
          ? ' 平均阅读速度：' + avgWpm + ' 词/分钟。'
          : ' Avg speed: ' + avgWpm + ' wpm.';
      }
    } catch(e) {}

    document.getElementById('wr-tip').textContent = tip;
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

  // ===== REVIEW ALERT =====
  _calcStatus(word) {
    if (!word.reviews || word.reviews.length === 0) return 'new';
    if (word.reviews.length >= this.REVIEW_INTERVALS.length) return 'mastered';
    const today = new Date();
    const todayStr = this._dateStr(today);
    const lastReview = new Date(word.reviews[word.reviews.length - 1] + 'T00:00:00');
    const daysSince = Math.floor((today - lastReview) / 86400000);
    const nextInterval = this.REVIEW_INTERVALS[word.reviews.length - 1] || this.REVIEW_INTERVALS[0];
    if (daysSince >= nextInterval) return 'review';
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
    startDate.setDate(startDate.getDate() - 364);

    const statsMap = {};
    for (const [date, data] of Object.entries(this.dailyStats)) {
      const words = typeof data === 'object' ? (data.words || 0) : data;
      statsMap[date] = words;
    }

    const cols = [];
    let current = new Date(startDate);
    const dayOfWeek = current.getDay();
    current.setDate(current.getDate() - dayOfWeek);

    const months = [];
    let lastMonth = -1;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    while (current <= endDate) {
      const week = [];
      let isFirstOfMonth = false;
      for (let d = 0; d < 7; d++) {
        const date = new Date(current);
        date.setDate(date.getDate() + d);
        const dateStr = this._dateStr(date);
        if (date > endDate) {
          week.push({ date: dateStr, words: -1 });
        } else if (date < startDate) {
          week.push({ date: dateStr, words: -1 });
        } else {
          const words = statsMap[dateStr] || 0;
          if (date.getMonth() !== lastMonth) {
            lastMonth = date.getMonth();
            isFirstOfMonth = true;
          }
          week.push({ date: dateStr, words: words, monthLabel: isFirstOfMonth ? monthNames[lastMonth] : null });
          isFirstOfMonth = false;
        }
      }
      cols.push(week);
      current.setDate(current.getDate() + 7);
    }

    const grid = document.getElementById('heatmap-grid');
    const monthsEl = document.getElementById('heatmap-months');

    monthsEl.innerHTML = cols.map(col => {
      const label = col.find(c => c.monthLabel) || {};
      return '<span class="heatmap-month-label">' + (label.monthLabel || '') + '</span>';
    }).join('');

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
    const today = this._dateStr(new Date());
    if (!word.reviews) word.reviews = [];
    if (!word.reviews.includes(today)) {
      word.reviews.push(today);
      word.status = this._calcStatus(word);
      try { Sync.set('el_vocab', this.vocab); } catch(e) {}
    }
    Reader.showWordPopup(word.word, event);
    setTimeout(() => this._renderVocab(), 500);
  },

  _removeVocab(idx, event) {
    event.stopPropagation();
    event.preventDefault();
    this.vocab.splice(idx, 1);
    try { Sync.set('el_vocab', this.vocab); } catch(e) {}
    this._renderVocab();
  },

  addVocab(word, phonetic, definition) {
    // Check if already exists
    if (this.vocab.some(w => w.word.toLowerCase() === word.toLowerCase())) return;
    this.vocab.push({
      word, phonetic, definition,
      addedAt: new Date().toISOString(),
      reviews: [],
      status: 'new'
    });
    try { Sync.set('el_vocab', this.vocab); } catch(e) {}
    App._updateQuickEntries();
  },

  // ===== VOCAB EXPORT =====
  exportVocab(format) {
    const filtered = this._filterVocab();
    if (filtered.length === 0) {
      App.toast(Settings.get('language') === 'zh' ? '没有可导出的单词' : 'No words to export');
      return;
    }

    let content, filename, mimeType;

    switch (format) {
      case 'csv':
        // Anki-compatible CSV: front, back
        content = filtered.map(w =>
          '"' + w.word + '","' + (w.definition || '') + (w.phonetic ? ' /' + w.phonetic + '/' : '') + '"'
        ).join('\n');
        content = 'Word,Definition\n' + content;
        filename = 'vocabulary_anki.csv';
        mimeType = 'text/csv';
        break;

      case 'markdown':
        content = '# My Vocabulary\n\n';
        content += '| Word | Phonetic | Definition | Status |\n';
        content += '|------|----------|------------|--------|\n';
        content += filtered.map(w => {
          const status = this._calcStatus(w);
          const statusLabels = { new: 'New', review: 'Review', reviewing: 'Learning', mastered: 'Mastered' };
          return '| ' + w.word + ' | ' + (w.phonetic ? '/' + w.phonetic + '/' : '-') + ' | ' + (w.definition || '-') + ' | ' + (statusLabels[status] || status) + ' |';
        }).join('\n');
        filename = 'vocabulary.md';
        mimeType = 'text/markdown';
        break;

      case 'text':
        content = filtered.map(w => w.word + (w.definition ? ' — ' + w.definition : '')).join('\n');
        filename = 'vocabulary.txt';
        mimeType = 'text/plain';
        break;

      case 'clipboard':
        content = filtered.map(w => w.word + (w.definition ? '\t' + w.definition : '')).join('\n');
        navigator.clipboard.writeText(content).then(() => {
          App.toast(Settings.get('language') === 'zh'
            ? '已复制 ' + filtered.length + ' 个单词到剪贴板 📋'
            : 'Copied ' + filtered.length + ' words to clipboard 📋');
        }).catch(() => {
          App.toast(Settings.get('language') === 'zh' ? '复制失败' : 'Copy failed');
        });
        return;

      default: return;
    }

    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    App.toast(Settings.get('language') === 'zh'
      ? '已导出 ' + filtered.length + ' 个单词 📤'
      : 'Exported ' + filtered.length + ' words 📤');
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

  // ===== FOCUS HISTORY =====
  _renderFocusHistory() {
    const section = document.getElementById('focus-history-section');
    const list = document.getElementById('focus-history-list');
    try {
      const sessions = Sync.get('el_focus_sessions') || [];
      if (sessions.length === 0) { section.style.display = 'none'; return; }
      section.style.display = '';
      const isZh = Settings.get('language') === 'zh';
      const recent = sessions.slice(-10).reverse();
      list.innerHTML = recent.map(s => {
        const date = new Date(s.date).toLocaleDateString();
        const article = s.articleId ? Data.getById(s.articleId) : null;
        const articleTitle = article ? article.title : (isZh ? '自由阅读' : 'Free reading');
        return '<div class="profile-article-card" style="cursor:default">' +
          '<span class="pa-icon">🧘</span>' +
          '<div class="pa-info">' +
            '<div class="pa-title">' + s.duration + ' min · ' + this._escape(articleTitle) + '</div>' +
            '<div class="pa-meta">' + date + (s.partial ? ' · ' + (isZh ? '提前结束' : 'Early end') : '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch(e) { section.style.display = 'none'; }
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

  // ===== DAILY STATS =====
  recordRead(article) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let stats = Sync.get('el_daily_stats') || {};
      if (!stats[today]) stats[today] = { articles: 0, words: 0 };
      stats[today].articles = (stats[today].articles || 0) + 1;
      stats[today].words = (stats[today].words || 0) + (article.wordCount || 0);
      Sync.set('el_daily_stats', stats);
    } catch(e) {}
  },

  saveLastRead(articleId, progress) {
    try {
      const data = { articleId, progress, timestamp: Date.now() };
      Sync.set('el_last_read', data);
    } catch(e) {}
  },

  clearLastRead() {
    try { Sync.set('el_last_read', null); } catch(e) {}
  },

  // ===== ACCOUNT =====
  _renderAccount() {
    const loggedOut = document.getElementById('account-logged-out');
    const loggedIn = document.getElementById('account-logged-in');
    const emailEl = document.getElementById('account-email');
    const logoutBtn = document.getElementById('btn-logout');

    if (Auth.isLoggedIn) {
      if (loggedOut) loggedOut.style.display = 'none';
      if (loggedIn) loggedIn.style.display = '';
      if (emailEl) emailEl.textContent = Auth.user?.email || '';
      if (logoutBtn) {
        logoutBtn.onclick = async () => {
          try {
            await Auth.logout();
            Profile.render();
            App.toast(Settings.get('language') === 'zh' ? '已退出登录' : 'Logged out');
          } catch(e) {
            App.toast('Logout failed');
          }
        };
      }
    } else {
      if (loggedOut) loggedOut.style.display = '';
      if (loggedIn) loggedIn.style.display = 'none';
    }
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
