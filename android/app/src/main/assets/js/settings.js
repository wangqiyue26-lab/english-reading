/* ============================================
   Settings Module — All App Configuration
   ============================================ */

const Settings = {
  defaults: {
    // System & UI
    language: 'zh',
    theme: 'light',         // light (warm) | cool-light | sepia | dark | system
    density: 'comfort',     // comfort | compact
    accentColor: 'amber',   // amber | forest | navy | crimson | violet | teal | rose-gold | custom
    accentCustom: '',       // Custom hex for accent
    readerBg: 'default',    // default | white | sepia
    fontPairing: 'classic', // classic | modern | magazine | minimal | comfort

    // Reader Layout
    fontFamily: 'system',
    fontSize: 18,
    lineSpacing: 1.7,
    contentWidth: 'medium',
    immersiveMode: false,
    progressDisplay: 'percent',

    // Learning Assistance
    vocabLevel: '',
    vocabHighlight: false,
    examBank: [],
    clickAction: 'instant',
    dictionaryType: 'simple',

    // Content & Discovery
    hideBelowDifficulty: '',
    hideAboveDifficulty: '',
    interests: [],
    dailyGoal: 0,
    dailyGoalEnabled: false,
    hideRead: false,

    // Profile
    learningGoal: '',
    onboardingLevel: '',
    dailyTargetMinutes: 0,
  },

  i18n: {
    zh: {
      settings: '设置', reading: '英语阅读', profile_title: '个人主页', account: '账户', logged_in_as: '已登录为',
      tab_system: '界面', tab_reader: '阅读器', tab_learning: '学习辅助', tab_content: '内容过滤',
      language: '系统语言', theme: '显示模式', density: '紧凑度',
      lang_zh: '简体中文', lang_en: 'English',
      theme_light: '暖白 (默认)', theme_dark: '深色', theme_system: '跟随系统', theme_clean: '冷白',
      density_comfort: '舒适', density_compact: '紧凑',
      fontFamily: '正文字体', font_system: '系统默认', font_serif: '衬线体 (Serif)', font_dyslexic: '阅读障碍友好',
      fontSize: '字号', lineSpacing: '行间距', contentWidth: '页面宽度',
      width_narrow: '窄', width_medium: '中', width_wide: '宽',
      immersive: '沉浸模式', immersive_desc: '阅读时自动隐藏顶栏',
      progress: '进度显示', progress_percent: '百分比', progress_time: '剩余时长', progress_hidden: '隐藏',
      vocabLevel: '分级高亮', vocabLevel_desc: '高亮超过选定等级的词汇',
      vocabOff: '关闭', examBank: '考试词库标记', exam_ielts: '雅思', exam_toefl: '托福', exam_gre: 'GRE',
      clickAction: '查词方式', click_instant: '点击即翻译', click_select: '选中后翻译', click_sidebar: '侧边栏常驻',
      dictType: '词典选择', dict_simple: '简明释义', dict_enen: '英英释义',
      aiSummary: 'AI 摘要', aiSummary_desc: '文首显示 3 条要点 (需 API)',
      hideBelow: '屏蔽低于', hideAbove: '屏蔽高于', difficulty_off: '不限',
      interests: '兴趣偏好', dailyGoal: '每日目标', dailyGoal_desc: '篇/天',
      save: '保存', reset: '恢复默认', close: '关闭',
      reading_progress: '阅读进度', today_read: '今日已读', articles: '篇',
      word_level: '等级', word_ielts: '雅思', word_toefl: '托福', word_gre: 'GRE',
      mark_read: '标记已读', mark_read_done: '已读', bookmark: '收藏', bookmark_done: '已收藏',
      streak_days: '连续打卡天数', total_reads: '累计阅读', month_days: '本月打卡',
      vocab_notebook: '生词本', vocab_empty: '点击文章中的单词查词后会自动加入生词本',
      my_bookmarks: '我的收藏', bookmark_empty: '还没有收藏文章',
      my_reads: '已读文章', read_empty: '还没有已读文章', hide_read: '隐藏已读',
      resume_reading: '继续阅读', review_due: '今日有 {n} 个单词待复习',
      heatmap: '学习热力图', heatmap_year: '近一年', heatmap_less: '少', heatmap_more: '多',
      vocab_all: '全部', vocab_review: '待复习', vocab_mastered: '已掌握',
      level_0: '初学者', level_1: '阅读爱好者', level_2: '资深读者',
      level_3: '评论员', level_4: '学术专家',
      level_next: '还需 {n} 天升级至 {name}',
      daily_goal: '每日目标', my_notes: '我的笔记',
      weekly_report: '本周学习报告', articles_read: '篇数', words_read: '字数',
      minutes_read: '分钟', focus_sessions: '专注记录',
      journals: '期刊', difficulty: '难度', sentence_tr: '逐句翻译',
      full_tr: '全文翻译', read_aloud: '全文朗读', ai_summary: 'AI 摘要',
    },
    en: {
      settings: 'Settings', reading: 'English Reading', profile_title: 'Profile', account: 'Account', logged_in_as: 'Logged in as',
      tab_system: 'System', tab_reader: 'Reader', tab_learning: 'Learning', tab_content: 'Content',
      language: 'Language', theme: 'Theme', density: 'Density',
      lang_zh: '简体中文', lang_en: 'English',
      theme_light: 'Warm Light', theme_dark: 'Dark', theme_system: 'Follow System', theme_clean: 'Cool Light',
      density_comfort: 'Comfort', density_compact: 'Compact',
      fontFamily: 'Font Family', font_system: 'System Default', font_serif: 'Serif', font_dyslexic: 'OpenDyslexic',
      fontSize: 'Font Size', lineSpacing: 'Line Spacing', contentWidth: 'Content Width',
      width_narrow: 'Narrow', width_medium: 'Medium', width_wide: 'Wide',
      immersive: 'Immersive Mode', immersive_desc: 'Auto-hide top bar while reading',
      progress: 'Progress Display', progress_percent: 'Percentage', progress_time: 'Time Remaining', progress_hidden: 'Hidden',
      vocabLevel: 'Vocab Highlight', vocabLevel_desc: 'Highlight words above selected level',
      vocabOff: 'Off', examBank: 'Exam Word Banks', exam_ielts: 'IELTS', exam_toefl: 'TOEFL', exam_gre: 'GRE',
      clickAction: 'Lookup Action', click_instant: 'Tap to Translate', click_select: 'Select to Translate', click_sidebar: 'Sidebar',
      dictType: 'Dictionary', dict_simple: 'Simple', dict_enen: 'English-English',
      aiSummary: 'AI Summary', aiSummary_desc: 'Show 3 key points (API needed)',
      hideBelow: 'Hide Below', hideAbove: 'Hide Above', difficulty_off: 'No Limit',
      interests: 'Interests', dailyGoal: 'Daily Goal', dailyGoal_desc: 'articles/day',
      save: 'Save', reset: 'Reset', close: 'Close',
      reading_progress: 'Reading Progress', today_read: "Today's Read", articles: 'articles',
      word_level: 'Level', word_ielts: 'IELTS', word_toefl: 'TOEFL', word_gre: 'GRE',
      mark_read: 'Mark Read', mark_read_done: 'Read', bookmark: 'Bookmark', bookmark_done: 'Bookmarked',
      streak_days: 'Day Streak', total_reads: 'Total Reads', month_days: 'This Month',
      vocab_notebook: 'Vocabulary', vocab_empty: 'Tap words while reading to add them here',
      my_bookmarks: 'Bookmarks', bookmark_empty: 'No bookmarks yet',
      my_reads: 'Read Articles', read_empty: 'No articles read yet', hide_read: 'Hide Read',
      resume_reading: 'Resume Reading', review_due: '{n} words due for review today',
      heatmap: 'Learning Heatmap', heatmap_year: 'Past Year', heatmap_less: 'Less', heatmap_more: 'More',
      vocab_all: 'All', vocab_review: 'Review', vocab_mastered: 'Mastered',
      level_0: 'Beginner', level_1: 'Bookworm', level_2: 'Senior Reader',
      level_3: 'Commentator', level_4: 'Academic Expert',
      level_next: '{n} days to {name}',
      daily_goal: 'Daily Goal', my_notes: 'My Notes',
      weekly_report: 'Weekly Report', articles_read: 'Articles', words_read: 'Words',
      minutes_read: 'Minutes', focus_sessions: 'Focus Sessions',
      journals: 'Journals', difficulty: 'Difficulty', sentence_tr: 'Sentence Tr.',
      full_tr: 'Full Translation', read_aloud: 'Read Aloud', ai_summary: 'AI Summary',
    }
  },

  _data: {},

  init() {
    this._load();
    this._applyAll();
    this._injectDyslexicFont();
  },

  _load() {
    try {
      const saved = Sync.get('el_settings');
      this._data = saved ? { ...this.defaults, ...saved } : { ...this.defaults };
      if (!Array.isArray(this._data.examBank)) this._data.examBank = [];
      if (!Array.isArray(this._data.interests)) this._data.interests = [];
    } catch(e) {
      this._data = { ...this.defaults };
      console.warn('Settings load failed, using defaults:', e);
    }
  },

  save() {
    try {
      Sync.set('el_settings', this._data);
    } catch(e) {}
    this._applyAll();
    if (App && App.renderHome) App.renderHome();
  },

  reset() {
    this._data = { ...this.defaults };
    this.save();
  },

  get(key) { return this._data[key] ?? this.defaults[key]; },
  set(key, value) { this._data[key] = value; },

  t(key) {
    const lang = this._data.language || 'zh';
    return (this.i18n[lang] && this.i18n[lang][key]) || this.i18n['zh'][key] || key;
  },

  _applyAll() {
    const root = document.documentElement;
    // Theme
    root.setAttribute('data-theme', this._data.theme === 'system' ? this._detectSystemTheme() : this._data.theme);

    // Apply accent color
    this._applyStoredAccent();

    // Density
    root.style.setProperty('--density-gap', this._data.density === 'compact' ? '6px' : '10px');
    root.style.setProperty('--density-padding', this._data.density === 'compact' ? '10px' : '14px');

    // Font
    const fontMap = { system: 'var(--font-body)', serif: '"Georgia", "Times New Roman", serif', dyslexic: '"OpenDyslexic", "Comic Sans MS", cursive' };
    root.style.setProperty('--reader-font', fontMap[this._data.fontFamily] || fontMap.system);
    root.style.setProperty('--reader-font-size', this._data.fontSize + 'px');
    root.style.setProperty('--reader-line-height', String(this._data.lineSpacing));
    const widthMap = { narrow: '560px', medium: '680px', wide: '100%' };
    root.style.setProperty('--reader-width', widthMap[this._data.contentWidth] || widthMap.medium);

    // Immersive mode
    const topBar = document.querySelector('.top-bar');
    if (this._data.immersiveMode) {
      document.addEventListener('scroll', this._immersiveScroll);
    } else {
      document.removeEventListener('scroll', this._immersiveScroll);
      if (topBar) topBar.style.transform = '';
    }
  },

  _applyStoredAccent() {
    const color = this._data.accentColor || 'amber';
    const custom = this._data.accentCustom || '';
    const root = document.documentElement;

    if (color === 'custom' && custom) {
      root.style.setProperty('--accent', custom);
      root.style.setProperty('--accent-deep', this._darkenHex(custom, 0.15));
      root.style.setProperty('--accent-light', custom + '18');
      return;
    }

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

  _darkenHex(hex, amount) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const dr = Math.round(r * (1 - amount));
    const dg = Math.round(g * (1 - amount));
    const db = Math.round(b * (1 - amount));
    return '#' + [dr, dg, db].map(c => c.toString(16).padStart(2, '0')).join('');
  },

  _immersiveScroll() {
    const topBar = document.querySelector('.top-bar');
    if (!topBar) return;
    const onReader = document.getElementById('reader-page').classList.contains('active');
    if (!onReader) { topBar.style.transform = ''; return; }
    const scrollY = window.scrollY;
    topBar.style.transform = scrollY > 200 ? 'translateY(-100%)' : '';
  },

  _detectSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  _injectDyslexicFont() {
    if (!document.getElementById('font-dyslexic')) {
      const link = document.createElement('link');
      link.id = 'font-dyslexic';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.cdnfonts.com/css/open-dyslexic';
      document.head.appendChild(link);
    }
  },

  // ===== VOCABULARY HIGHLIGHTING =====
  _vocabLists: null,

  async loadVocabLists() {
    if (this._vocabLists) return;
    this._vocabLists = { ALL: new Set() };
    const lists = {
      ielts: 'abandon abstract academic access accommodate accompany accumulate accurate achieve acknowledge acquire adapt adequate adjust administration adult advocate affect aggregate aid albeit allocate alter alternative ambiguous amend analogy analyse annual anticipate apparent append appreciate approach appropriate arbitrary area assign assist assume assure attach attain attitude attribute author authority available aware behalf benefit bias brief bulk capable capacity category cease challenge channel chapter chart chemical circumstance cite civil clarify classic clause code coherent coincide collapse colleague commence comment commission commit commodity communicate community compatible compensate compile complement complex component compound comprehensive comprise conceive concentrate concept conclude concurrent conduct confer confine confirm conflict conform consent consequent considerable consist constant constitute construct consult consume contact contemporary context contract contradict contrary contrast contribute controversy convene converse convert convince cooperate coordinate core corporate correspond couple create credit criteria crucial culture currency cycle data debate decade decline deduce defend define definite demonstrate denote deny depress derive design despite detect deviate device devote differentiate dimension diminish discrete discriminate displace display dispose distinct distort distribute diverse document domain domestic dominate draft drama duration dynamic economic edition element eliminate emerge emphasis empirical enable encounter energy enforce enhance enormous ensure entity environment equate equipment equivalent error establish estate estimate ethical ethnic evaluate eventual evident evolve exceed exclude exhibit expand expert explicit exploit export expose external extract facilitate factor feature federal fee file final finance finite flexible fluctuate focus forbid forecast format formula forthcoming foundation founded framework function fund fundamental furthermore gender generate generation global goal grade grant guarantee guideline hence hierarchy highlight hypothesis identical identify ideology ignorance illustrate image immigration impact implement implicit imply impose incentive incidence incline income incorporate index indicate individual induce inevitable infer infrastructure inherent inhibit initial initiate injure innovate input insert insight inspect instance institute integral integrate integrity intelligence intense interact internal interpret interval intervene intrinsic invest investigate invoke involve isolate issue job journal justify label labour layer lecture legal legislation levy liberal licence likewise link locate logic maintain major manipulate manual margin mature maximum mechanism media mediate medical medium mental method migrate military minimal minimum minister ministry minor mode modify monitor motive mutual negate network neutral nevertheless nonetheless norm normal notion nuclear objective obtain obvious occupy occur odd offset ongoing operate option orient outcome output overall overlap overseas panel paradigm paragraph parallel parameter participate partner passive perceive percent period persist perspective phase phenomenon philosophy physical plus policy portion pose positive potential practitioner precede precise predict predominant preliminary presume previous prime principal principle prior priority proceed process professional prohibit project promote proportion prospect protocol provision psychological publication publish purchase pursue qualitative quote radical random range ratio rational react recover refine regime region register regulate reinforce reject relax release relevant reluctance rely remove require research reside resolve resource respond restore restrain restrict retain reveal revenue reverse revise revolution rigid role route scenario schedule scheme scope section sector secure seek select sequence series sex shift significant similar simulate site so-called sole somewhat source specific sphere stable statistic status straightforward strategy stress structure style submit subordinate subsequent subsidy substitute successor sufficient sum summary supplement survey survive suspend sustain symbol tape target task team technical technique technology temporary tension terminate text theme theoretical theory thereby thesis topic trace tradition transfer transform transit transmit transport trend trigger ultimate undergo underlie undertake uniform unique utilise valid vary vehicle version via violate virtual visible vision visual volume voluntary welfare whereas widespread',
      toefl: 'abandon abstract academy access accommodate accompany accumulate accurate achieve acknowledge acquire adapt adequate adjacent adjust administrate adult advocate affect aggregate aid albeit allocate alter alternative ambiguous amend analogy analyze annual anticipate apparent append appreciate approach appropriate approximate arbitrary area aspect assemble assess assign assist assume assure attach attain attitude attribute audience authority available aware behalf benefit bias bond brief bulk capable capacity category cease challenge channel chapter chart chemical circumstance cite civil claim clarify classic clause code coherent coincide collapse colleague commence comment commission commit commodity communicate community compatible compensate compile complement complex component compound comprehensive comprise conceive concentrate concept conclude concurrent conduct confer confine confirm conflict conform consent consequent considerable consist constant constitute construct consult consume contact contemporary context contract contradict contrary contrast contribute controversy convene converse convert convince cooperate coordinate core corporate correspond couple create credit criteria crucial culture currency cycle data debate decade decline deduce defend define definite demonstrate denote deny depress derive design despite detect deviate device devote differentiate dimension diminish discrete discriminate displace display dispose distinct distort distribute diverse document domain domestic dominate draft drama duration dynamic economic edition element eliminate emerge emphasis empirical enable encounter energy enforce enhance enormous ensure entity environment equate equipment equivalent error establish estate estimate ethical ethnic evaluate eventual evident evolve exceed exclude exhibit expand expert explicit exploit export expose external extract facilitate factor feature federal fee file final finance finite flexible fluctuate focus forbid forecast format formula forthcoming foundation founded framework function fund fundamental furthermore gender generate generation global goal grade grant guarantee guideline hence hierarchy highlight hypothesis identical identify ideology ignorance illustrate image immigration impact implement implicit imply impose incentive incidence incline income incorporate index indicate individual induce inevitable infer infrastructure inherent inhibit initial initiate injure innovate input insert insight inspect instance institute integral integrate integrity intelligence intense interact internal interpret interval intervene intrinsic invest investigate invoke involve isolate issue job journal justify label labour layer lecture legal legislation levy liberal licence likewise link locate logic maintain major manipulate manual margin mature maximum mechanism media mediate medical medium mental method migrate military minimal minimum minister ministry minor mode modify monitor motive mutual negate network neutral nevertheless nonetheless norm normal notion nuclear objective obtain obvious occupy occur odd offset ongoing operate option orient outcome output overall overlap overseas panel paradigm paragraph parallel parameter participate partner passive perceive percent period persist perspective phase phenomenon philosophy physical plus policy portion pose positive potential practitioner precede precise predict predominant preliminary presume previous prime principal principle prior priority proceed process professional prohibit project promote proportion prospect protocol provision psychological publication publish purchase pursue qualitative quote radical random range ratio rational react recover refine regime region register regulate reinforce reject relax release relevant reluctance rely remove require research reside resolve resource respond restore restrain restrict retain reveal revenue reverse revise revolution rigid role route scenario schedule scheme scope section sector secure seek select sequence series sex shift significant similar simulate site so-called sole somewhat source specific sphere stable statistic status straightforward strategy stress structure style submit subordinate subsequent subsidy substitute successor sufficient sum summary supplement survey survive suspend sustain symbol tape target task team technical technique technology temporary tension terminate text theme theoretical theory thereby thesis topic trace tradition transfer transform transit transmit transport trend trigger ultimate undergo underlie undertake uniform unique utilise valid vary vehicle version via violate virtual visible vision visual volume voluntary welfare whereas widespread',
      gre: 'aberrant abeyance abscond abstemious admonish adulterate aesthetic aggregate alacrity amalgamate ambiguous ameliorate anachronism analogous anoint anomaly antipathy apathy appease apprise approbation arduous artless ascetic assiduous attenuate audacious austere aver baleful banal belie bellicose bombastic boorish burgeon burnish buttress capricious castigation caustic chicanery circumscribe coerce cogent commensurate complaisant conciliatory condone confound connoisseur contentious contrite conundrum convoluted craven credulous crystalline daunt decorous deference delineate denigrate deride desiccate desultory diatribe didactic diffidence dilatory dilettante disabuse discerning discordant disingenuous disparage dissemble dissonant dogmatic ebullient efficacious egregious elegy elicit emollient empirical emulate endemic enervate engender ephemeral equanimity equivocate erudite esoteric estimable eulogy exacerbate exacting excoriate exigent extrapolate facetious fallacious fastidious fawning felicitous fervid flag florid foment forestall fractious fulminate furtive gainsay garrulous germane glib gossamer grandiose gregarious guile hackneyed halcyon harangue hedonistic heretical hubris iconoclast idiosyncratic ignominious immutable impassive imperious imperturbable implacable implicit improvident impudent inadvertent incipient inchoate incongruous incontrovertible incorrigible incredulous indict indifferent indigenous indolent ineffable inexorable ingenuous inimical innocuous insipid insouciant intractable intransigent intrepid inveterate irascible laconic laud lethargic levity libertine limpid listless logorrheic loquacious lucid magnanimous malevolent malleable maverick mendacious mercurial metamorphosis meticulous mitigate mollify morose mundane munificent myopic nadir nascent nefarious neophyte nihilism nonchalant noxious obdurate obfuscate oblique obsequious obstinate obviate odious officious onerous opprobrium ostentatious painstaking panacea paragon pariah parsimonious partisan patent paucity pedantic pejorative penurious perennial perfidious perfunctory pernicious perspicacious pertinacious pervasive petulant philanthropic phlegmatic placate plastic platitude plethora plucky porous pragmatic precarious precipitate precursor predilection preeminent prescience presumptuous prevaricate pristine probity prodigal proficient profligate profound prohibitive proliferate propensity propitiate propriety prosaic proscribe protean prudent pungent qualified querulous quiescent quotidian rancor rarefy recalcitrant recant recondite redoubtable refractory refute relegate remonstrate renege reprehensible reproach repudiate rescind resilient resolute resolve reticent reverent rigorous robust rudimentary ruminate rustic sagacious salient sanction sanguine satiate saturnine savant sedulous skeptical solicitous soporific specious sporadic spurious squander static steadfast stigma stipulate stoic striated stringent strut sublime subside substantiate succinct superfluous supplant supposition surfeit surreptitious sycophant tacit taciturn talisman tangential tautology tenuous terrestrial timorous tirade torpid tortuous tractable transient translucent trenchant truculent turgid ubiquitous umbrage unadorned unconscionable undermine underscore unequivocal unheralded unobtrusive unprecedented unprepossessing untenable untoward unwitting upbraid urbane vacillate vapid variance vaunt venal venerate veracious verbose vex viable vindicate virtuoso virulent viscous vitriolic vituperate vociferous volatile voracious voracity warrant wary whimsical wistful zealous'
    };

    for (const [exam, words] of Object.entries(lists)) {
      const ws = new Set(words.split(' ').filter(w => w.length > 2));
      for (const w of [...ws]) {
        if (w.endsWith('e')) { ws.add(w + 'd'); ws.add(w + 's'); ws.add(w.slice(0, -1) + 'ing'); }
        else if (w.endsWith('y')) { ws.add(w.slice(0, -1) + 'ied'); ws.add(w.slice(0, -1) + 'ies'); }
        else { ws.add(w + 'ed'); ws.add(w + 's'); ws.add(w + 'ing'); }
      }
      this._vocabLists[exam.toUpperCase()] = ws;
      ws.forEach(w => this._vocabLists['ALL'].add(w));
    }
  },

  getWordLabels(word) {
    if (!this._vocabLists) return [];
    const w = word.toLowerCase();
    const labels = [];
    if (this._data.examBank.includes('ielts') && this._vocabLists['IELTS']?.has(w)) labels.push('IELTS');
    if (this._data.examBank.includes('toefl') && this._vocabLists['TOEFL']?.has(w)) labels.push('TOEFL');
    if (this._data.examBank.includes('gre') && this._vocabLists['GRE']?.has(w)) labels.push('GRE');
    return labels;
  },

  isHighlightedWord(word) {
    if (!this._vocabLists || !this._data.vocabHighlight) return false;
    const level = this._data.vocabLevel;
    if (!level) {
      return this._vocabLists['ALL'].has(word.toLowerCase());
    }
    return this._vocabLists['ALL'].has(word.toLowerCase());
  }
};
