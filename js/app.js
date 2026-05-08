/* ============================================
   Main App - Settings, Routing, Reading Goals
   ============================================ */

const App = {
  state: {
    currentJournal: null,
    currentDifficulty: null,
    readToday: 0
  },

  async init() {
    // Wrap each init step so one failure doesn't block everything
    const safeInit = (name, fn) => {
      try { fn(); } catch(e) { console.warn('Init failed:', name, e); }
    };

    safeInit('settings', () => Settings.init());
    
    try { await Settings.loadVocabLists(); } catch(e) { console.warn('Vocab lists failed:', e); }

    safeInit('dictionary', () => Dictionary.init());
    safeInit('translator', () => Translator.init());
    safeInit('reader', () => Reader.init());

    // Update UI language
    this._applyLanguage();

    // Load articles
    await Data.load();

    // Load reading goal
    this._loadReadingGoal();

    // Bind events
    this._bindNav();
    this._bindSettings();
    this.renderHome();
    this._updateGoalBar();
  },

  _applyLanguage() {
    const lang = Settings.get('language');
    const map = Settings.i18n[lang] || Settings.i18n.zh;
    document.querySelectorAll('[data-lang]').forEach(el => {
      const key = el.getAttribute('data-lang');
      if (map[key]) el.textContent = map[key];
    });
    document.getElementById('app-title').textContent = map.reading || 'English Reading';
  },

  _bindNav() {
    document.getElementById('btn-back').addEventListener('click', () => {
      Reader.hidePopup();
      this.renderHome();
    });

    // Settings button
    document.getElementById('btn-settings').addEventListener('click', () => {
      this._openSettings();
    });

    // Event delegation for article cards (most robust cross-browser)
    document.getElementById('article-list').addEventListener('click', function(e) {
      // Polyfill closest for older browsers
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
    } catch(e) { /* storage unavailable */ }

    const goal = Settings.get('dailyGoal');
    if (Settings.get('dailyGoalEnabled') && goal > 0 && this.state.readToday >= goal) {
      this._showGoalToast();
    }
    this._updateGoalBar();
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
      document.getElementById('goal-progress').style.width = pct + '%';
    } else {
      bar.style.display = 'none';
    }
  },

  _showGoalToast() {
    const toast = document.getElementById('goal-toast');
    document.getElementById('goal-toast-text').textContent =
      Settings.get('language') === 'zh' ? '今日阅读目标达成！' : 'Daily reading goal reached!';
    toast.style.display = '';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
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

    // Tab switching
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
    const isZh = lang === 'zh';

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
              <option value="light" ${Settings.get('theme')==='light'?'selected':''}>${t('theme_light')}</option>
              <option value="dark" ${Settings.get('theme')==='dark'?'selected':''}>${t('theme_dark')}</option>
              <option value="system" ${Settings.get('theme')==='system'?'selected':''}>${t('theme_system')}</option>
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
        <div class="settings-row">
          <div>
            <div class="settings-label">${t('grammar')}</div>
            <div class="settings-desc">${t('grammar_desc')}</div>
          </div>
          <button class="settings-toggle" data-key="grammar" disabled title="API key required"></button>
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

    // Select elements
    content.querySelectorAll('.settings-select').forEach(select => {
      select.removeEventListener('change', this._onSettingChange);
      select.addEventListener('change', this._onSettingChange);
    });

    // Toggle buttons
    content.querySelectorAll('.settings-toggle').forEach(btn => {
      btn.removeEventListener('click', this._onToggleClick);
      btn.addEventListener('click', this._onToggleClick);
    });

    // Sliders
    content.querySelectorAll('.settings-slider').forEach(slider => {
      slider.removeEventListener('input', this._onSliderInput);
      slider.addEventListener('input', this._onSliderInput);
    });

    // Chips
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
    // Update value display
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
      // Single select
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

  // ===== HOME PAGE =====
  renderHome() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('home-page').classList.add('active');
    document.getElementById('app-title').textContent = Settings.t('reading');
    this._updateBackButton();
    this._updateGoalBar();
    this.renderJournals();
    this.renderDifficulties();
    this.renderArticles();
  },

  renderJournals() {
    const grid = document.getElementById('journal-grid');
    grid.innerHTML = '';

    const allCard = document.createElement('div');
    allCard.className = 'journal-card' + (!this.state.currentJournal ? ' active' : '');
    allCard.innerHTML = `<div class="icon">📚</div><div class="name">${Settings.get('language')==='zh'?'全部期刊':'All Journals'}</div><div class="count">${Data.articles.length} ${Settings.get('language')==='zh'?'篇文章':'articles'}</div>`;
    allCard.addEventListener('click', () => { this.state.currentJournal = null; this.renderHome(); });
    grid.appendChild(allCard);

    for (const j of Data.journals) {
      const card = document.createElement('div');
      card.className = 'journal-card' + (this.state.currentJournal === j.key ? ' active' : '');
      const name = Settings.get('language') === 'zh' ? j.name : j.nameEn;
      card.innerHTML = `<div class="icon">${j.icon}</div><div class="name">${name}</div><div class="count">${j.count} ${Settings.get('language')==='zh'?'篇文章':'articles'}</div>`;
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
      // Check if hidden by settings
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

    // Apply difficulty hide settings
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

    // Apply interest preference (boost matching articles to top)
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
      list.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>${Settings.get('language')==='zh'?'没有找到匹配的文章':'No matching articles'}</p></div>`;
      return;
    }

    list.innerHTML = '';
    for (const a of articles) {
      const card = document.createElement('div');
      card.className = 'article-card';
      card.setAttribute('data-id', a.id);
      const color = Data.getDifficultyColor(a.difficulty);
      card.innerHTML = `
        <div class="title">${a.title}</div>
        <div class="meta">
          <span class="difficulty-dot" style="background:${color}"></span>
          ${a.difficultyLabel}
          <span class="dot"></span>${a.date}
          <span class="dot"></span>${a.wordCount} words
        </div>
        ${a.tags ? `<div class="tags">${a.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
      `;
      list.appendChild(card);
    }
  },

  _applyReaderStyles() {
    // Apply reader-specific CSS variables after entering reader
    const root = document.documentElement;
    const fontMap = { system: 'var(--font-serif)', serif: '"Georgia", "Times New Roman", serif', dyslexic: '"OpenDyslexic", "Comic Sans MS", cursive' };
    root.style.setProperty('--reader-font', fontMap[Settings.get('fontFamily')] || fontMap.system);
    root.style.setProperty('--reader-font-size', Settings.get('fontSize') + 'px');
    root.style.setProperty('--reader-line-height', String(Settings.get('lineSpacing')));
    const widthMap = { narrow: '560px', medium: '680px', wide: '100%' };
    root.style.setProperty('--reader-width', widthMap[Settings.get('contentWidth')] || '680px');
  },

  _updateBackButton() {
    const btn = document.getElementById('btn-back');
    const readerActive = document.getElementById('reader-page').classList.contains('active');
    btn.style.display = readerActive ? '' : 'none';
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
