/* ============================================
   Main App — Hero, Search, Onboarding,
   Homepage, Routing, Keyboard Shortcuts
   ============================================ */

const App = {
  state: {
    currentJournal: null,
    currentDifficulty: null,
    readToday: 0,
    searchOpen: false,
    onboardingData: {}
  },

  async init() {
    const safeInit = (name, fn) => {
      try { fn(); } catch(e) { console.warn('Init failed:', name, e); }
    };

    safeInit('settings', () => Settings.init());

    // Init auth (non-blocking)
    safeInit('auth', () => Auth.init());
    safeInit('auth-ui', () => AuthUI.init());

    try { await Settings.loadVocabLists(); } catch(e) { console.warn('Vocab lists failed:', e); }

    safeInit('dictionary', () => Dictionary.init());
    safeInit('translator', () => Translator.init());
    safeInit('reader', () => Reader.init());
    safeInit('profile', () => Profile.init());

    this._applyLanguage();

    await Data.load();
    safeInit('sync', () => Sync.init());
    this._loadReadingGoal();
    this._bindNav();
    this._bindSettings();
    this._bindSearch();
    this._bindKeyboardShortcuts();
    this.renderHome();
    this._updateGoalBar();
    this._checkOnboarding();
    this._updateQuickEntries();
  },

  // ===== ONBOARDING =====
  _checkOnboarding() {
    const done = localStorage.getItem('el_onboarding_done');
    if (!done) {
      setTimeout(() => this._showOnboarding(), 600);
    }
  },

  _showOnboarding() {
    document.getElementById('onboarding-overlay').classList.add('open');
    this._onboardingStep = 1;
    this.state.onboardingData = {};
    document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
    document.querySelector('.ob-step[data-step="1"]').classList.add('active');
    this._bindOnboardingOptions();
  },

  _bindOnboardingOptions() {
    document.querySelectorAll('.ob-options').forEach(container => {
      container.querySelectorAll('.ob-option').forEach(opt => {
        opt.onclick = () => {
          const isMulti = container.getAttribute('data-multi') === 'true';
          const key = container.getAttribute('data-key');
          const value = opt.getAttribute('data-value');
          if (isMulti) {
            opt.classList.toggle('selected');
            if (!this.state.onboardingData[key]) this.state.onboardingData[key] = [];
            if (opt.classList.contains('selected')) {
              if (!this.state.onboardingData[key].includes(value)) this.state.onboardingData[key].push(value);
            } else {
              this.state.onboardingData[key] = this.state.onboardingData[key].filter(v => v !== value);
            }
          } else {
            container.querySelectorAll('.ob-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            this.state.onboardingData[key] = value;
          }
        };
      });
    });
  },

  _nextOnboardingStep() {
    const currentStep = this._onboardingStep || 1;
    const nextStep = currentStep + 1;
    if (nextStep > 4) { this._finishOnboarding(); return; }
    document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
    const nextEl = document.querySelector('.ob-step[data-step="' + nextStep + '"]');
    if (nextEl) nextEl.classList.add('active');
    this._onboardingStep = nextStep;
    this._bindOnboardingOptions();
  },

  _prevOnboardingStep() {
    const prevStep = (this._onboardingStep || 2) - 1;
    if (prevStep < 1) return;
    document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
    document.querySelector('.ob-step[data-step="' + prevStep + '"]').classList.add('active');
    this._onboardingStep = prevStep;
    this._bindOnboardingOptions();
  },

  _skipOnboarding() {
    document.getElementById('onboarding-overlay').classList.remove('open');
    localStorage.setItem('el_onboarding_done', '1');
  },

  _finishOnboarding() {
    document.getElementById('onboarding-overlay').classList.remove('open');
    localStorage.setItem('el_onboarding_done', '1');

    const d = this.state.onboardingData;
    // Map onboarding level to difficulty filter
    if (d.level) {
      const levelMap = { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced', expert: 'expert' };
      const diffKey = levelMap[d.level];
      if (diffKey) {
        Settings.set('onboardingLevel', diffKey);
        this.state.currentDifficulty = diffKey;
      }
    }
    // Save interests
    if (d.interests && d.interests.length > 0) {
      Settings.set('interests', d.interests);
    }
    // Save user goal for profile/reporting
    if (d.goal) {
      Settings.set('learningGoal', d.goal);
    }
    // Set daily goal
    if (d.dailyTarget) {
      const target = parseInt(d.dailyTarget);
      if (!isNaN(target)) {
        Settings.set('dailyGoal', target);
        Settings.set('dailyGoalEnabled', true);
      } else {
        // It's a time-based target
        Settings.set('dailyTargetMinutes', parseInt(d.dailyTarget));
        Settings.set('dailyGoal', 3); // default
        Settings.set('dailyGoalEnabled', true);
      }
    }
    // Save profile
    try {
      localStorage.setItem('el_user_profile', JSON.stringify(d));
    } catch(e) {}

    Settings.save();
    this.renderHome();
    this._updateQuickEntries();
  },

  // ===== SEARCH =====
  _bindSearch() {
    const searchBtn = document.getElementById('btn-search');
    const searchPanel = document.getElementById('search-panel');
    const searchInput = document.getElementById('search-input');

    searchBtn.addEventListener('click', () => {
      this.state.searchOpen = !this.state.searchOpen;
      if (this.state.searchOpen) {
        searchPanel.classList.add('open');
        setTimeout(() => searchInput.focus(), 100);
      } else {
        searchPanel.classList.remove('open');
        searchInput.value = '';
        document.getElementById('search-results').innerHTML = '';
      }
    });

    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const q = searchInput.value.trim();
      if (!q) {
        document.getElementById('search-results').innerHTML = '';
        return;
      }
      searchTimeout = setTimeout(() => this._performSearch(q), 250);
    });

    // Close search on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.searchOpen) {
        this.state.searchOpen = false;
        searchPanel.classList.remove('open');
        searchInput.value = '';
        document.getElementById('search-results').innerHTML = '';
      }
    });
  },

  _performSearch(query) {
    const results = document.getElementById('search-results');
    if (!Data.articles || Data.articles.length === 0) {
      results.innerHTML = '<div class="search-no-results">No articles loaded</div>';
      return;
    }
    const q = query.toLowerCase();
    const matches = Data.articles.filter(a => {
      if (a.title.toLowerCase().includes(q)) return true;
      if (a.content && a.content.toLowerCase().includes(q)) return true;
      if (a.tags && a.tags.some(t => t.toLowerCase().includes(q))) return true;
      if (a.journal && a.journal.toLowerCase().includes(q)) return true;
      return false;
    }).slice(0, 20);

    if (matches.length === 0) {
      results.innerHTML = '<div class="search-no-results">No articles found for "' + this._escapeHtml(query) + '"</div>';
      return;
    }

    const isZh = Settings.get('language') === 'zh';
    results.innerHTML = matches.map(a => {
      const preview = a.content ? a.content.split('\n\n')[0].slice(0, 120) : '';
      return '<div class="search-result-item" data-id="' + a.id + '">' +
        '<div class="sr-title">' + this._highlightMatch(a.title, q) + '</div>' +
        '<div class="sr-meta">' + a.journal + ' · ' + a.difficultyLabel + ' · ' + a.wordCount + ' words</div>' +
        (preview ? '<div class="sr-preview">' + this._escapeHtml(preview) + '...</div>' : '') +
        '</div>';
    }).join('');

    results.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const article = Data.getById(id);
        if (article) {
          this.state.searchOpen = false;
          document.getElementById('search-panel').classList.remove('open');
          document.getElementById('search-input').value = '';
          document.getElementById('search-results').innerHTML = '';
          Reader.open(article);
          this._markArticleRead();
          this._updateBackButton();
          this._applyReaderStyles();
        }
      });
    });
  },

  _highlightMatch(text, query) {
    const escaped = this._escapeHtml(text);
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(re, '<mark style="background:var(--accent-light);color:var(--accent);padding:1px 3px;border-radius:2px;">$1</mark>');
  },

  _escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // ===== KEYBOARD SHORTCUTS =====
  _bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      // Don't trigger when settings/onboarding is open
      if (document.getElementById('settings-overlay').classList.contains('open')) return;
      if (document.getElementById('onboarding-overlay').classList.contains('open')) return;
      if (document.getElementById('kbd-help-overlay').classList.contains('open')) {
        if (e.key === 'Escape') { document.getElementById('kbd-help-overlay').classList.remove('open'); return; }
        return;
      }
      if (document.getElementById('focus-overlay').classList.contains('open')) {
        if (e.key === 'Escape') { Reader.exitFocusMode(); return; }
        return;
      }

      const readerActive = document.getElementById('reader-page').classList.contains('active');

      switch (e.key) {
        case '?':
          e.preventDefault();
          document.getElementById('kbd-help-overlay').classList.add('open');
          break;
        case 'Escape':
          if (readerActive) { this.renderHome(); }
          document.getElementById('kbd-help-overlay').classList.remove('open');
          break;
        case 'ArrowLeft':
          if (readerActive && e.ctrlKey === false && e.metaKey === false) {
            e.preventDefault(); this._navigateArticle(-1);
          }
          break;
        case 'ArrowRight':
          if (readerActive && e.ctrlKey === false && e.metaKey === false) {
            e.preventDefault(); this._navigateArticle(1);
          }
          break;
        case ' ':
          if (readerActive) {
            e.preventDefault();
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
          }
          break;
        case 't':
        case 'T':
          if (readerActive) { e.preventDefault(); Reader.toggleSentenceTranslation(); }
          break;
        case 'f':
        case 'F':
          if (readerActive) { e.preventDefault(); Reader.toggleFullTranslation(); }
          break;
        case 's':
        case 'S':
          if (readerActive) { e.preventDefault(); Reader.toggleReadAloud(); }
          break;
        case 'b':
        case 'B':
          if (readerActive) { e.preventDefault(); Reader.toggleBookmark(); }
          break;
        case 'z':
        case 'Z':
          if (readerActive) { e.preventDefault(); Reader.toggleFocusMode(); }
          break;
        case 'ArrowUp':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const fs = Settings.get('fontSize');
            Settings.set('fontSize', Math.min(24, fs + 1));
            Settings.save();
            if (readerActive) this._applyReaderStyles();
          }
          break;
        case 'ArrowDown':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const fs2 = Settings.get('fontSize');
            Settings.set('fontSize', Math.max(14, fs2 - 1));
            Settings.save();
            if (readerActive) this._applyReaderStyles();
          }
          break;
      }
    });

    // Close keyboard help overlay on click outside
    document.getElementById('kbd-help-overlay').addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  },

  _navigateArticle(direction) {
    if (!Reader.article) return;
    const allArticles = Data.filter(this.state.currentJournal, this.state.currentDifficulty);
    // Apply hide read
    let readIds = [];
    try { readIds = Sync.get('el_read') || []; } catch(e) {}
    if (Settings.get('hideRead')) {
      // Still navigate among visible
    }
    const currentIdx = allArticles.findIndex(a => a.id === Reader.article.id);
    if (currentIdx === -1) return;
    const newIdx = currentIdx + direction;
    if (newIdx >= 0 && newIdx < allArticles.length) {
      Reader.open(allArticles[newIdx]);
      this._markArticleRead();
      this._applyReaderStyles();
    }
  },

  // ===== READING GOAL =====
  _loadReadingGoal() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const stored = localStorage.getItem('el_goal_' + today);
      this.state.readToday = stored ? parseInt(stored) : 0;
    } catch(e) { this.state.readToday = 0; }
  },

  _markArticleRead() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      this.state.readToday++;
      localStorage.setItem('el_goal_' + today, String(this.state.readToday));

      let streakDates = Sync.get('el_streak_dates') || [];
      if (!Array.isArray(streakDates)) streakDates = [];
      if (!streakDates.includes(today)) {
        streakDates.push(today);
        Sync.set('el_streak_dates', streakDates);
      }

      if (Reader && Reader.article) {
        Profile.recordRead(Reader.article);
      }
    } catch(e) {}

    const goal = Settings.get('dailyGoal');
    if (Settings.get('dailyGoalEnabled') && goal > 0 && this.state.readToday >= goal) {
      this._showGoalToast();
    }
    this._updateGoalBar();
    this._updateQuickEntries();
  },

  _updateGoalBar() {
    const bar = document.getElementById('goal-bar');
    const enabled = Settings.get('dailyGoalEnabled');
    const goal = Settings.get('dailyGoal');
    if (enabled && goal > 0) {
      bar.style.display = '';
      document.getElementById('goal-count').textContent = this.state.readToday;
      document.getElementById('goal-target').textContent = goal;
      const pct = Math.min(100, (this.state.readToday / goal) * 100);
      const prog = document.getElementById('goal-progress');
      prog.style.width = pct + '%';
      if (pct >= 100) {
        prog.classList.add('completed');
      } else {
        prog.classList.remove('completed');
      }
    } else {
      bar.style.display = 'none';
    }
  },

  _showGoalToast() {
    const toast = document.getElementById('goal-toast');
    document.getElementById('goal-toast-text').textContent =
      Settings.get('language') === 'zh' ? '今日阅读目标达成！🎉' : 'Daily reading goal reached! 🎉';
    toast.style.display = '';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  },

  // ===== QUICK ENTRIES =====
  _updateQuickEntries() {
    // Resume reading
    try {
      const lastRead = Sync.get('el_last_read');
      const resumeEl = document.getElementById('qe-resume');
      const resumeSub = document.getElementById('qe-resume-sub');
      if (lastRead && lastRead.articleId && lastRead.progress < 100) {
        const article = Data.getById(lastRead.articleId);
        if (article) {
          resumeEl.style.display = '';
          resumeSub.textContent = article.journal + ' · ' + lastRead.progress + '%';
        } else {
          resumeEl.style.display = 'none';
        }
      } else {
        resumeEl.style.display = 'none';
      }
    } catch(e) { document.getElementById('qe-resume').style.display = 'none'; }

    // Daily goal
    const goal = Settings.get('dailyGoal');
    const enabled = Settings.get('dailyGoalEnabled');
    const goalSub = document.getElementById('qe-goal-sub');
    if (enabled && goal > 0) {
      goalSub.textContent = this.state.readToday + '/' + goal + ' ' + (Settings.get('language')==='zh'?'篇':'articles');
    } else {
      goalSub.textContent = Settings.get('language')==='zh'?'设置目标':'Set a goal';
    }

    // Vocabulary count
    let vocabCount = 0;
    try { vocabCount = (Sync.get('el_vocab') || []).length; } catch(e) {}
    document.getElementById('qe-vocab-sub').textContent = vocabCount + ' ' + (Settings.get('language')==='zh'?'词':'words');

    // Bookmark count
    let bmCount = 0;
    try { bmCount = (Sync.get('el_bookmark') || []).length; } catch(e) {}
    document.getElementById('qe-bookmark-sub').textContent = bmCount + ' ' + (Settings.get('language')==='zh'?'篇':'articles');
  },

  _quickResume() {
    try {
      const lastRead = Sync.get('el_last_read');
      if (lastRead && lastRead.articleId) {
        const article = Data.getById(lastRead.articleId);
        if (article) {
          Reader.open(article);
          this._updateBackButton();
          this._applyReaderStyles();
        }
      }
    } catch(e) {}
  },

  _quickDailyGoal() {
    // Open settings to daily goal section, or profile
    Profile.open();
  },

  // ===== NAVIGATION =====
  _bindNav() {
    document.getElementById('btn-back').addEventListener('click', () => {
      Reader.hidePopup();
      this.renderHome();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      this._openSettings();
    });

    document.getElementById('btn-profile').addEventListener('click', () => {
      if (Auth.isLoggedIn) {
        Profile.open();
      } else {
        AuthUI.open();
      }
      this._updateBackButton();
    });

    // Article list delegation
    document.getElementById('article-list').addEventListener('click', function(e) {
      var el = e.target;
      while (el && el !== this) {
        if (el.classList && el.classList.contains('article-card')) break;
        el = el.parentElement;
      }
      if (!el || el === this) return;
      var id = el.getAttribute('data-id');
      if (!id) return;
      try {
        const article = Data.getById(id);
        if (article) {
          Reader.open(article);
          App._markArticleRead();
          App._updateBackButton();
          App._applyReaderStyles();
        }
      } catch(err) {
        console.warn('Open article failed:', err);
      }
    });

    // Daily recommend card
    const drCard = document.getElementById('daily-recommend');
    if (drCard) {
      drCard.addEventListener('click', () => {
        const recId = drCard.getAttribute('data-id');
        if (recId) {
          const article = Data.getById(recId);
          if (article) {
            Reader.open(article);
            this._markArticleRead();
            this._updateBackButton();
            this._applyReaderStyles();
          }
        }
      });
    }
  },

  // ===== SETTINGS =====
  _bindSettings() {
    document.getElementById('btn-close-settings').addEventListener('click', () => this._closeSettings());
    document.getElementById('settings-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this._closeSettings();
    });
    document.getElementById('btn-reset-settings').addEventListener('click', () => {
      Settings.reset();
      this._renderSettingsContent();
      this._applyLanguage();
      this._updateGoalBar();
    });

    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderSettingsContent();
      });
    });
  },

  _openSettings() {
    document.getElementById('settings-overlay').classList.add('open');
    this._renderSettingsContent();
  },
  _closeSettings() {
    document.getElementById('settings-overlay').classList.remove('open');
  },

  _renderSettingsContent() {
    const activeTab = document.querySelector('.settings-tab.active')?.getAttribute('data-tab') || 'system';
    const content = document.getElementById('settings-content');
    const t = (k) => Settings.t(k);
    const lang = Settings.get('language');

    let html = '';
    switch (activeTab) {
      case 'system': html = this._renderSystemSettings(t); break;
      case 'reader': html = this._renderReaderSettings(t); break;
      case 'learning': html = this._renderLearningSettings(t); break;
      case 'content': html = this._renderContentSettings(t); break;
    }
    content.innerHTML = html;
    this._bindSettingsControls();
  },

  _renderSystemSettings(t) {
    return `
      <div class="settings-section">
        <div class="settings-section-title">${t('language')} / ${t('theme')}</div>
        <div class="settings-row">
          <div><div class="settings-label">${t('language')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="language">
              <option value="zh" ${Settings.get('language')==='zh'?'selected':''}>${t('lang_zh')}</option>
              <option value="en" ${Settings.get('language')==='en'?'selected':''}>${t('lang_en')}</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">${t('theme')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="theme">
              <option value="light" ${Settings.get('theme')==='light'?'selected':''}>Warm Light</option>
              <option value="cool-light" ${Settings.get('theme')==='cool-light'?'selected':''}>Cool Light</option>
              <option value="sepia" ${Settings.get('theme')==='sepia'?'selected':''}>Sepia</option>
              <option value="dark" ${Settings.get('theme')==='dark'?'selected':''}>${t('theme_dark')}</option>
              <option value="system" ${Settings.get('theme')==='system'?'selected':''}>${t('theme_system')}</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Accent Color</div></div>
          <div class="settings-control">
            <div class="accent-picker">
              <span class="accent-swatch ${(Settings.get('accentColor')||'amber')==='amber'?'active':''}" data-color="amber" onclick="App._pickAccent('amber')"></span>
              <span class="accent-swatch ${Settings.get('accentColor')==='forest'?'active':''}" data-color="forest" onclick="App._pickAccent('forest')"></span>
              <span class="accent-swatch ${Settings.get('accentColor')==='navy'?'active':''}" data-color="navy" onclick="App._pickAccent('navy')"></span>
              <span class="accent-swatch ${Settings.get('accentColor')==='crimson'?'active':''}" data-color="crimson" onclick="App._pickAccent('crimson')"></span>
              <span class="accent-swatch ${Settings.get('accentColor')==='violet'?'active':''}" data-color="violet" onclick="App._pickAccent('violet')"></span>
              <span class="accent-swatch ${Settings.get('accentColor')==='teal'?'active':''}" data-color="teal" onclick="App._pickAccent('teal')"></span>
              <span class="accent-swatch ${Settings.get('accentColor')==='rose-gold'?'active':''}" data-color="rose-gold" onclick="App._pickAccent('rose-gold')"></span>
            </div>
            <div class="accent-custom">
              <input type="text" placeholder="#d4954b" id="accent-custom-input" maxlength="7" value="${Settings.get('accentCustom')||''}">
              <button class="vocab-export-btn" onclick="App._pickCustomAccent()">Apply</button>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Reader Background</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="readerBg">
              <option value="default" ${Settings.get('readerBg')==='default'?'selected':''}>Warm Paper</option>
              <option value="white" ${Settings.get('readerBg')==='white'?'selected':''}>Pure White</option>
              <option value="sepia" ${Settings.get('readerBg')==='sepia'?'selected':''}>Sepia</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">${t('density')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="density">
              <option value="comfort" ${Settings.get('density')==='comfort'?'selected':''}>${t('density_comfort')}</option>
              <option value="compact" ${Settings.get('density')==='compact'?'selected':''}>${t('density_compact')}</option>
            </select>
          </div>
        </div>
      </div>`;
  },

  _pickAccent(color) {
    Settings.set('accentColor', color);
    Settings.save();
    this._applyAccentColor(color);
    this._renderSettingsContent();
  },

  _pickCustomAccent() {
    const val = document.getElementById('accent-custom-input')?.value?.trim();
    if (val && /^#[0-9a-fA-F]{6}$/.test(val)) {
      Settings.set('accentCustom', val);
      Settings.set('accentColor', 'custom');
      Settings.save();
      this._applyCustomAccent(val);
      this._renderSettingsContent();
    }
  },

  _applyAccentColor(color) {
    const root = document.documentElement;
    const colors = {
      'amber':      ['#d4954b', '#b8782e', '#faf3e8'],
      'forest':     ['#3d8c5e', '#2d6a4f', '#e8f5e9'],
      'navy':       ['#1a56db', '#1244b0', '#e8f0fe'],
      'crimson':    ['#c4554d', '#a84040', '#fce8e6'],
      'violet':     ['#7c3aed', '#6d28d9', '#ede9fe'],
      'teal':       ['#0d9488', '#0f766e', '#e6fffa'],
      'rose-gold':  ['#b76e79', '#9a5a64', '#fdf2f4']
    };
    const [accent, deep, light] = colors[color] || colors['amber'];
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-deep', deep);
    root.style.setProperty('--accent-light', light);
  },

  _applyCustomAccent(hex) {
    const root = document.documentElement;
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-deep', this._darkenHex(hex, 0.15));
    root.style.setProperty('--accent-light', hex + '18');
  },

  _darkenHex(hex, amount) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const dr = Math.round(r * (1 - amount));
    const dg = Math.round(g * (1 - amount));
    const db = Math.round(b * (1 - amount));
    return '#' + [dr, dg, db].map(c => c.toString(16).padStart(2, '0')).join('');
  },

  _renderReaderSettings(t) {
    const fs = Settings.get('fontSize');
    return `
      <div class="settings-section">
        <div class="settings-section-title">${t('fontFamily')}</div>
        <div class="settings-row">
          <div><div class="settings-label">${t('fontFamily')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="fontFamily">
              <option value="system" ${Settings.get('fontFamily')==='system'?'selected':''}>${t('font_system')}</option>
              <option value="serif" ${Settings.get('fontFamily')==='serif'?'selected':''}>${t('font_serif')}</option>
              <option value="dyslexic" ${Settings.get('fontFamily')==='dyslexic'?'selected':''}>${t('font_dyslexic')}</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">${t('fontSize')}</div></div>
          <div class="settings-control">
            <input type="range" class="settings-slider" data-key="fontSize" min="14" max="24" value="${fs}">
            <span class="settings-slider-value">${fs}px</span>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">${t('lineSpacing')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="lineSpacing">
              <option value="1.5" ${Settings.get('lineSpacing')==1.5?'selected':''}>1.5</option>
              <option value="1.7" ${Settings.get('lineSpacing')==1.7?'selected':''}>1.7</option>
              <option value="1.8" ${Settings.get('lineSpacing')==1.8?'selected':''}>1.8</option>
              <option value="2.0" ${Settings.get('lineSpacing')==2.0?'selected':''}>2.0</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">${t('contentWidth')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="contentWidth">
              <option value="narrow" ${Settings.get('contentWidth')==='narrow'?'selected':''}>${t('width_narrow')}</option>
              <option value="medium" ${Settings.get('contentWidth')==='medium'?'selected':''}>${t('width_medium')}</option>
              <option value="wide" ${Settings.get('contentWidth')==='wide'?'selected':''}>${t('width_wide')}</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">Font Pairing</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="fontPairing">
              <option value="classic" ${Settings.get('fontPairing')==='classic'?'selected':''}>Classic (Georgia + Inter)</option>
              <option value="modern" ${Settings.get('fontPairing')==='modern'?'selected':''}>Modern (Inter + Georgia)</option>
              <option value="magazine" ${Settings.get('fontPairing')==='magazine'?'selected':''}>Magazine (Playfair + Inter)</option>
              <option value="minimal" ${Settings.get('fontPairing')==='minimal'?'selected':''}>Minimal (System fonts)</option>
              <option value="comfort" ${Settings.get('fontPairing')==='comfort'?'selected':''}>Comfort (Atkinson Hyperlegible)</option>
            </select>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">${t('immersive')}</div>
        <div class="settings-row">
          <div>
            <div class="settings-label">${t('immersive')}</div>
            <div class="settings-desc">${t('immersive_desc')}</div>
          </div>
          <button class="settings-toggle ${Settings.get('immersiveMode')?'on':''}" data-key="immersiveMode"></button>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">${t('progress')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="progressDisplay">
              <option value="percent" ${Settings.get('progressDisplay')==='percent'?'selected':''}>${t('progress_percent')}</option>
              <option value="time" ${Settings.get('progressDisplay')==='time'?'selected':''}>${t('progress_time')}</option>
              <option value="hidden" ${Settings.get('progressDisplay')==='hidden'?'selected':''}>${t('progress_hidden')}</option>
            </select>
          </div>
        </div>
      </div>`;
  },

  _renderLearningSettings(t) {
    return `
      <div class="settings-section">
        <div class="settings-section-title">${t('vocabLevel')}</div>
        <div class="settings-row">
          <div>
            <div class="settings-label">${t('vocabLevel')}</div>
            <div class="settings-desc">${t('vocabLevel_desc')}</div>
          </div>
          <div class="settings-control">
            <select class="settings-select" data-key="vocabLevel">
              <option value="" ${!Settings.get('vocabLevel')?'selected':''}>${t('vocabOff')}</option>
              <option value="B1" ${Settings.get('vocabLevel')==='B1'?'selected':''}>B1</option>
              <option value="B2" ${Settings.get('vocabLevel')==='B2'?'selected':''}>B2</option>
              <option value="C1" ${Settings.get('vocabLevel')==='C1'?'selected':''}>C1</option>
              <option value="C2" ${Settings.get('vocabLevel')==='C2'?'selected':''}>C2</option>
            </select>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">${t('examBank')}</div>
        <div class="settings-row">
          <div><div class="settings-label">${t('examBank')}</div></div>
          <div class="settings-chips" data-key="examBank" data-multi="true">
            <span class="settings-chip ${Settings.get('examBank').includes('ielts')?'active':''}" data-value="ielts">${t('exam_ielts')}</span>
            <span class="settings-chip ${Settings.get('examBank').includes('toefl')?'active':''}" data-value="toefl">${t('exam_toefl')}</span>
            <span class="settings-chip ${Settings.get('examBank').includes('gre')?'active':''}" data-value="gre">${t('exam_gre')}</span>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">${t('clickAction')}</div>
        <div class="settings-row">
          <div><div class="settings-label">${t('clickAction')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="clickAction">
              <option value="instant" ${Settings.get('clickAction')==='instant'?'selected':''}>${t('click_instant')}</option>
              <option value="select" ${Settings.get('clickAction')==='select'?'selected':''}>${t('click_select')}</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">${t('dictType')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="dictionaryType">
              <option value="simple" ${Settings.get('dictionaryType')==='simple'?'selected':''}>${t('dict_simple')}</option>
              <option value="enen" ${Settings.get('dictionaryType')==='enen'?'selected':''}>${t('dict_enen')}</option>
            </select>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">AI</div>
        <div class="settings-row">
          <div>
            <div class="settings-label">${t('aiSummary')}</div>
            <div class="settings-desc">${t('aiSummary_desc')}</div>
          </div>
          <button class="settings-toggle" data-key="aiSummary" disabled title="API key required"></button>
        </div>
      </div>`;
  },

  _renderContentSettings(t) {
    const diffs = Data.difficulties;
    return `
      <div class="settings-section">
        <div class="settings-section-title">${t('hideBelow')} / ${t('hideAbove')}</div>
        <div class="settings-row">
          <div><div class="settings-label">${t('hideBelow')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="hideBelowDifficulty">
              <option value="" ${!Settings.get('hideBelowDifficulty')?'selected':''}>${t('difficulty_off')}</option>
              ${diffs.map(d => `<option value="${d.key}" ${Settings.get('hideBelowDifficulty')===d.key?'selected':''}>${d.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div><div class="settings-label">${t('hideAbove')}</div></div>
          <div class="settings-control">
            <select class="settings-select" data-key="hideAboveDifficulty">
              <option value="" ${!Settings.get('hideAboveDifficulty')?'selected':''}>${t('difficulty_off')}</option>
              ${diffs.map(d => `<option value="${d.key}" ${Settings.get('hideAboveDifficulty')===d.key?'selected':''}>${d.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">${t('interests')}</div>
        <div class="settings-row">
          <div class="settings-chips" data-key="interests" data-multi="true">
            ${['technology','economics','politics','science','culture','business','world','China','US','UK','environment'].map(tag =>
              `<span class="settings-chip ${Settings.get('interests').includes(tag)?'active':''}" data-value="${tag}">${tag}</span>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">${t('dailyGoal')}</div>
        <div class="settings-row">
          <div>
            <div class="settings-label">${t('dailyGoal')}</div>
            <div class="settings-desc">${t('dailyGoal_desc')}</div>
          </div>
          <div class="settings-control">
            <button class="settings-toggle ${Settings.get('dailyGoalEnabled')?'on':''}" data-key="dailyGoalEnabled"></button>
            <select class="settings-select" data-key="dailyGoal" style="min-width:80px">
              ${[1,2,3,5,7,10].map(n => `<option value="${n}" ${Settings.get('dailyGoal')===n?'selected':''}>${n} ${t('articles')}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>`;
  },

  _bindSettingsControls() {
    const content = document.getElementById('settings-content');

    content.querySelectorAll('.settings-select').forEach(select => {
      select.removeEventListener('change', this._onSettingChange);
      select.addEventListener('change', this._onSettingChange);
    });

    content.querySelectorAll('.settings-toggle').forEach(btn => {
      btn.removeEventListener('click', this._onToggleClick);
      btn.addEventListener('click', this._onToggleClick);
    });

    content.querySelectorAll('.settings-slider').forEach(slider => {
      slider.removeEventListener('input', this._onSliderInput);
      slider.addEventListener('input', this._onSliderInput);
    });

    content.querySelectorAll('.settings-chips .settings-chip').forEach(chip => {
      chip.removeEventListener('click', this._onChipClick);
      chip.addEventListener('click', this._onChipClick);
    });
  },

  _onSettingChange(e) {
    const key = e.target.getAttribute('data-key');
    const value = e.target.value;
    Settings.set(key, key === 'dailyGoal' ? parseInt(value) : value);
    Settings.save();
    if (key === 'language') {
      App._applyLanguage();
      App._renderSettingsContent();
    }
    if (key === 'dailyGoalEnabled' || key === 'dailyGoal') App._updateGoalBar();
  },

  _onToggleClick(e) {
    const btn = e.currentTarget;
    const key = btn.getAttribute('data-key');
    const current = Settings.get(key);
    Settings.set(key, !current);
    Settings.save();
    btn.classList.toggle('on', !current);
    if (key === 'dailyGoalEnabled') App._updateGoalBar();
  },

  _onSliderInput(e) {
    const slider = e.target;
    const key = slider.getAttribute('data-key');
    const value = parseInt(slider.value);
    Settings.set(key, value);
    Settings.save();
    const display = slider.nextElementSibling;
    if (display && display.classList.contains('settings-slider-value')) {
      display.textContent = value + 'px';
    }
  },

  _onChipClick(e) {
    const chip = e.currentTarget;
    const container = chip.parentElement;
    const key = container.getAttribute('data-key');
    const value = chip.getAttribute('data-value');
    const isMulti = container.getAttribute('data-multi') === 'true';

    if (isMulti) {
      let arr = Settings.get(key) || [];
      if (arr.includes(value)) {
        arr = arr.filter(v => v !== value);
        chip.classList.remove('active');
      } else {
        arr = [...arr, value];
        chip.classList.add('active');
      }
      Settings.set(key, arr);
    } else {
      container.querySelectorAll('.settings-chip').forEach(c => c.classList.remove('active'));
      const current = Settings.get(key);
      if (current === value) {
        Settings.set(key, '');
        chip.classList.remove('active');
      } else {
        Settings.set(key, value);
        chip.classList.add('active');
      }
    }
    Settings.save();
  },

  // ===== LANGUAGE =====
  _applyLanguage() {
    const lang = Settings.get('language');
    const map = Settings.i18n[lang] || Settings.i18n.zh;
    document.querySelectorAll('[data-lang]').forEach(el => {
      const key = el.getAttribute('data-lang');
      if (map[key]) el.textContent = map[key];
    });
    document.getElementById('app-title').textContent = map.reading || 'English Reading';
    this._updateHeroGreeting();
  },

  // ===== HERO AREA =====
  _updateHeroGreeting() {
    const hour = new Date().getHours();
    const lang = Settings.get('language');
    const isZh = lang === 'zh';
    let greeting, subtitle;

    if (hour < 12) {
      greeting = isZh ? '早上好 ☀️' : 'Good Morning ☀️';
      subtitle = isZh ? '新的一天，从一篇好文章开始' : 'A new day begins with a great article';
    } else if (hour < 18) {
      greeting = isZh ? '下午好 📖' : 'Good Afternoon 📖';
      subtitle = isZh ? '休息一下，读点有意思的' : 'Take a break, read something interesting';
    } else {
      greeting = isZh ? '晚上好 🌙' : 'Good Evening 🌙';
      subtitle = isZh ? '睡前阅读时间' : 'Time for bedtime reading';
    }

    document.getElementById('hero-greeting').textContent = greeting;
    document.getElementById('hero-subtitle').textContent = subtitle;

    // Streak badge
    try {
      const streakDates = Sync.get('el_streak_dates') || [];
      const unique = [...new Set(streakDates)].sort().reverse();
      let streak = 0;
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let checkDate = unique.includes(today) ? today : (unique.includes(yesterday) ? yesterday : unique[0] || '');
      if (checkDate) {
        let d = new Date(checkDate + 'T00:00:00');
        while (unique.includes(d.toISOString().slice(0, 10))) {
          streak++;
          d = new Date(d - 86400000);
        }
      }
      const badge = document.getElementById('hero-streak-badge');
      if (streak >= 2) {
        badge.style.display = '';
        document.getElementById('hero-streak-text').textContent = isZh
          ? streak + ' 天连续阅读 🔥'
          : streak + '-day streak 🔥';
      } else {
        badge.style.display = 'none';
      }
    } catch(e) { document.getElementById('hero-streak-badge').style.display = 'none'; }
  },

  // ===== HOME PAGE =====
  renderHome() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('home-page').classList.add('active');
    document.getElementById('app-title').textContent = Settings.t('reading');
    this._updateBackButton();
    this._updateGoalBar();
    this._updateHeroGreeting();
    this._renderDailyRecommend();
    this._updateQuickEntries();
    this.renderJournals();
    this.renderDifficulties();
    this.renderArticles();
  },

  // ===== DAILY RECOMMENDATION =====
  _renderDailyRecommend() {
    const card = document.getElementById('daily-recommend');
    if (!Data.articles || Data.articles.length === 0) {
      card.style.display = 'none';
      return;
    }

    // Pick today's recommendation (seeded by date)
    const today = new Date().toISOString().slice(0, 10);
    let pickData = Sync.get('el_daily_pick');
    if (pickData && pickData.date !== today) pickData = null;

    let article;
    if (pickData && pickData.date === today) {
      article = Data.getById(pickData.id);
    }
    if (!article) {
      // Pick based on interests or random
      const interests = Settings.get('interests');
      let pool = Data.articles.slice();
      if (interests && interests.length > 0) {
        const scored = pool.map(a => {
          const matchCount = a.tags ? a.tags.filter(t => interests.some(i => t.toLowerCase().includes(i.toLowerCase()))).length : 0;
          return { article: a, score: matchCount };
        });
        scored.sort((a, b) => b.score - a.score);
        // Pick from top third
        pool = scored.slice(0, Math.ceil(scored.length / 3)).map(s => s.article);
      }
      const seed = parseInt(today.replace(/-/g, '')) || 1;
      const idx = seed % pool.length;
      article = pool[idx];
      try {
        Sync.set('el_daily_pick', { date: today, id: article.id });
      } catch(e) {}
    }

    if (!article) { card.style.display = 'none'; return; }

    card.style.display = '';
    card.setAttribute('data-id', article.id);
    document.getElementById('dr-title').textContent = article.title;
    const jName = Settings.get('language') === 'zh' ? (article.journalZh || article.journal) : (article.journalEn || article.journal);
    document.getElementById('dr-source').textContent = jName + ' · ' + article.date;
    const preview = article.content
      ? article.content.split('\n\n')[0].replace(/\n/g, ' ').slice(0, 180)
      : '';
    document.getElementById('dr-preview').textContent = preview + (preview.length > 170 ? '...' : '');
    const tagsHtml = (article.tags || []).map(t => '<span class="tag">' + this._escapeHtml(t) + '</span>').join('');
    document.getElementById('dr-tags').innerHTML = tagsHtml;
    const wpm = 200;
    const readTime = Math.max(1, Math.round(article.wordCount / wpm));
    document.getElementById('dr-readtime').textContent = readTime + ' min read';
    document.getElementById('dr-difficulty').textContent = article.difficultyLabel;
  },

  renderJournals() {
    const grid = document.getElementById('journal-grid');
    grid.innerHTML = '';

    const allCard = document.createElement('div');
    allCard.className = 'journal-card' + (!this.state.currentJournal ? ' active' : '');
    allCard.innerHTML = '<div class="jc-cover default"></div><div class="jc-body"><div class="jc-icon">📚</div><div class="jc-name">' + (Settings.get('language')==='zh'?'全部期刊':'All Journals') + '</div><div class="jc-count">' + Data.articles.length + ' ' + (Settings.get('language')==='zh'?'篇':'articles') + '</div></div>';
    allCard.addEventListener('click', () => { this.state.currentJournal = null; this.renderHome(); });
    grid.appendChild(allCard);

    const coverClasses = {
      'the-economist': 'economist',
      'the-new-yorker': 'new-yorker',
      'the-atlantic': 'the-atlantic',
      'wired': 'wired',
      'new-york-times': 'nyt',
      'the-guardian': 'guardian',
      'nature': 'nature',
      'science': 'science',
      'harvard-business-review': 'hbr',
      'buzzfeed': 'buzzfeed',
      'business-insider': 'business-insider'
    };

    for (const j of Data.journals) {
      const card = document.createElement('div');
      card.className = 'journal-card' + (this.state.currentJournal === j.key ? ' active' : '');
      const name = Settings.get('language') === 'zh' ? j.name : j.nameEn;
      const coverClass = coverClasses[j.key] || 'default';
      card.innerHTML = '<div class="jc-cover ' + coverClass + '"></div><div class="jc-body"><div class="jc-icon">' + j.icon + '</div><div class="jc-name">' + this._escapeHtml(name) + '</div><div class="jc-count">' + j.count + ' ' + (Settings.get('language')==='zh'?'篇':'articles') + '</div></div>';
      card.addEventListener('click', () => {
        this.state.currentJournal = this.state.currentJournal === j.key ? null : j.key;
        this.renderHome();
      });
      grid.appendChild(card);
    }
  },

  renderDifficulties() {
    const chips = document.getElementById('difficulty-chips');
    chips.innerHTML = '';

    const allChip = document.createElement('span');
    allChip.className = 'chip' + (!this.state.currentDifficulty ? ' active' : '');
    allChip.textContent = Settings.get('language') === 'zh' ? '全部难度' : 'All Levels';
    allChip.addEventListener('click', () => { this.state.currentDifficulty = null; this.renderHome(); });
    chips.appendChild(allChip);

    for (const d of Data.difficulties) {
      const below = Settings.get('hideBelowDifficulty');
      const above = Settings.get('hideAboveDifficulty');
      const diffOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
      const dIdx = diffOrder.indexOf(d.key);
      if (below && diffOrder.indexOf(below) > dIdx) continue;
      if (above && diffOrder.indexOf(above) < dIdx) continue;

      const chip = document.createElement('span');
      chip.className = 'chip' + (this.state.currentDifficulty === d.key ? ' active' : '');
      chip.textContent = d.label;
      chip.addEventListener('click', () => {
        this.state.currentDifficulty = this.state.currentDifficulty === d.key ? null : d.key;
        this.renderHome();
      });
      chips.appendChild(chip);
    }
  },

  renderArticles() {
    const list = document.getElementById('article-list');
    let articles = Data.filter(this.state.currentJournal, this.state.currentDifficulty);

    const below = Settings.get('hideBelowDifficulty');
    const above = Settings.get('hideAboveDifficulty');
    if (below || above) {
      const diffOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
      articles = articles.filter(a => {
        const idx = diffOrder.indexOf(a.difficulty);
        if (below && diffOrder.indexOf(below) > idx) return false;
        if (above && diffOrder.indexOf(above) < idx) return false;
        return true;
      });
    }

    let readIds = [];
    let bookmarkIds = [];
    try {
      readIds = Sync.get('el_read') || [];
      bookmarkIds = Sync.get('el_bookmark') || [];
    } catch(e) {}

    if (Settings.get('hideRead')) {
      articles = articles.filter(a => !readIds.includes(a.id));
    }

    const interests = Settings.get('interests');
    if (interests && interests.length > 0) {
      const scored = articles.map(a => {
        const matchCount = a.tags ? a.tags.filter(t => interests.some(i => t.toLowerCase().includes(i.toLowerCase()))).length : 0;
        return { article: a, score: matchCount };
      });
      scored.sort((a, b) => b.score - a.score);
      articles = scored.map(s => s.article);
    }

    if (articles.length === 0) {
      const isZh = Settings.get('language') === 'zh';
      list.innerHTML = '<div class="empty-state">' +
        '<div class="empty-illustration">🔍</div>' +
        '<div class="empty-title">' + (isZh ? '没有找到匹配的文章' : 'No matching articles') + '</div>' +
        '<div class="empty-desc">' + (isZh ? '试试调整期刊或难度筛选条件' : 'Try adjusting your journal or difficulty filters') + '</div>' +
        '<button class="empty-action" onclick="App.state.currentJournal=null;App.state.currentDifficulty=null;App.renderHome()">' +
        (isZh ? '清除筛选条件' : 'Clear Filters') +
        '</button></div>';
      return;
    }

    const wpm = 200;
    const isZh = Settings.get('language') === 'zh';
    list.innerHTML = '';
    for (const a of articles) {
      const card = document.createElement('div');
      card.className = 'article-card';
      if (readIds.includes(a.id)) card.classList.add('read');
      if (bookmarkIds.includes(a.id)) card.classList.add('bookmarked');
      card.setAttribute('data-id', a.id);

      const readTime = Math.max(1, Math.round(a.wordCount / wpm));
      const color = Data.getDifficultyColor(a.difficulty);

      let statusIcons = '';
      if (readIds.includes(a.id)) statusIcons += '<span title="' + (isZh ? '已读' : 'Read') + '">✅</span>';
      if (bookmarkIds.includes(a.id)) statusIcons += '<span title="' + (isZh ? '已收藏' : 'Bookmarked') + '">⭐</span>';

      const preview = a.content
        ? a.content.split('\n\n')[0].replace(/\n/g, ' ').slice(0, 140)
        : '';

      const jName = isZh ? (a.journalZh || a.journal) : (a.journalEn || a.journal);

      card.innerHTML =
        (statusIcons ? '<div class="ac-status">' + statusIcons + '</div>' : '') +
        '<div class="ac-title">' + this._escapeHtml(a.title) + '</div>' +
        '<div class="ac-meta">' +
          '<span class="ac-difficulty-tag ' + a.difficulty + '">' + a.difficultyLabel + '</span>' +
          '<span class="ac-dot"></span>' + jName +
          '<span class="ac-dot"></span>' + a.date +
          '<span class="ac-dot"></span>' + readTime + ' min' +
        '</div>' +
        (a.tags ? '<div class="ac-tags">' + a.tags.map(t => '<span class="tag">' + this._escapeHtml(t) + '</span>').join('') + '</div>' : '') +
        (preview ? '<div class="ac-preview">' + this._escapeHtml(preview) + '...</div>' : '');

      list.appendChild(card);
    }
  },

  _applyReaderStyles() {
    const root = document.documentElement;
    const fontMap = { system: 'var(--font-body)', serif: '"Georgia", "Times New Roman", serif', dyslexic: '"OpenDyslexic", "Comic Sans MS", cursive' };
    root.style.setProperty('--reader-font', fontMap[Settings.get('fontFamily')] || fontMap.system);
    root.style.setProperty('--reader-font-size', Settings.get('fontSize') + 'px');
    root.style.setProperty('--reader-line-height', String(Settings.get('lineSpacing')));
    const widthMap = { narrow: '560px', medium: '680px', wide: '100%' };
    root.style.setProperty('--reader-width', widthMap[Settings.get('contentWidth')] || '680px');

    // Apply reader background if set
    const readerBg = Settings.get('readerBg') || 'default';
    const readerPage = document.querySelector('.reader-page');
    if (readerPage) {
      if (readerBg === 'white') readerPage.style.background = '#ffffff';
      else if (readerBg === 'sepia') readerPage.style.background = '#f4ecd8';
      else readerPage.style.background = '';
    }
  },

  _updateBackButton() {
    const btn = document.getElementById('btn-back');
    const readerActive = document.getElementById('reader-page').classList.contains('active');
    const profileActive = document.getElementById('profile-page').classList.contains('active');
    btn.style.display = (readerActive || profileActive) ? '' : 'none';
  },

  // ===== ARTICLE SHARE =====
  shareArticle(article) {
    if (!article) return;
    const isZh = Settings.get('language') === 'zh';
    const text = article.title + '\n' + article.journal + ' · ' + article.date + '\n' + (isZh ? '在 English Reading 阅读' : 'Read on English Reading');
    if (navigator.share) {
      navigator.share({ title: article.title, text: text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        App.toast(isZh ? '已复制到剪贴板 📋' : 'Copied to clipboard 📋');
      }).catch(() => {
        App.toast(isZh ? '分享失败' : 'Share failed');
      });
    }
  },

  toast(message, duration = 2000) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('visible'), duration);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
