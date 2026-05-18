/* ============================================
   Sync — localStorage ↔ Supabase data layer
   ============================================ */

const Sync = {
  // In-memory caches (mirrors localStorage keys when logged in)
  _cache: {},

  // Map localStorage keys → Supabase table + columns
  _map: {
    el_vocab:           { table: 'user_vocab',          type: 'vocab' },
    el_bookmark:        { table: 'user_bookmarks',      type: 'idlist', col: 'article_id' },
    el_read:            { table: 'user_reads',          type: 'idlist', col: 'article_id' },
    el_streak_dates:    { table: 'user_streak_dates',   type: 'datelist' },
    el_daily_stats:     { table: 'user_daily_stats',    type: 'dailystats' },
    el_last_read:       { table: 'user_last_read',      type: 'lastread' },
    el_reading_speeds:  { table: 'user_reading_speeds', type: 'speeds' },
    el_focus_sessions:  { table: 'user_focus_sessions', type: 'focus' },
    el_notes:           { table: 'user_notes',          type: 'notes' },
    el_settings:        { table: 'user_settings',       type: 'settings' },
    el_daily_pick:      { table: 'user_daily_pick',     type: 'dailypick' }
  },

  // ===== INIT =====
  async init() {
    if (Auth.isLoggedIn) {
      await this._pullAll();
    }
  },

  // ===== READ =====
  get(key) {
    if (Auth.isLoggedIn && this._cache[key] !== undefined) {
      return this._cache[key];
    }
    return this._localGet(key);
  },

  // ===== WRITE =====
  async set(key, value) {
    this._cache[key] = value;
    this._localSet(key, value);
    if (Auth.isLoggedIn) {
      await this._push(key, value).catch(() => {});
    }
  },

  // ===== MIGRATE LOCAL → CLOUD =====
  async migrateIfNeeded() {
    if (!Auth.isLoggedIn) return;
    const userId = Auth.user.id;
    const flag = localStorage.getItem('el_migrated_' + userId);
    if (flag) return;

    const keys = Object.keys(this._map);
    for (const key of keys) {
      const local = this._localGet(key);
      if (local === null || local === undefined) continue;
      try {
        await this._push(key, local);
        this._cache[key] = local;
      } catch (e) {
        console.warn('Migrate failed for', key, e);
      }
    }
    localStorage.setItem('el_migrated_' + userId, '1');
  },

  // ===== CLEAR MEMORY CACHE =====
  clearCache() {
    this._cache = {};
  },

  // ===== INTERNAL: PULL FROM SUPABASE =====
  async _pullAll() {
    const keys = Object.keys(this._map);
    for (const key of keys) {
      try {
        const data = await this._pull(key);
        if (data !== null) {
          this._cache[key] = data;
          this._localSet(key, data);
        }
      } catch (e) {
        // Offline or error — keep local copy
      }
    }
  },

  async _pull(key) {
    const info = this._map[key];
    const userId = Auth.user.id;

    switch (info.type) {
      case 'vocab': {
        const { data, error } = await window.supabaseClient.from(info.table).select('*').eq('user_id', userId);
        if (error) throw error;
        return (data || []).map(r => ({
          word: r.word, phonetic: r.phonetic, definition: r.definition,
          addedAt: r.added_at, reviews: r.reviews || [], status: r.status
        }));
      }
      case 'idlist': {
        const { data, error } = await window.supabaseClient.from(info.table).select(info.col).eq('user_id', userId);
        if (error) throw error;
        return (data || []).map(r => r[info.col]);
      }
      case 'datelist': {
        const { data, error } = await window.supabaseClient.from(info.table).select('date').eq('user_id', userId);
        if (error) throw error;
        return (data || []).map(r => r.date);
      }
      case 'dailystats': {
        const { data, error } = await window.supabaseClient.from(info.table).select('*').eq('user_id', userId);
        if (error) throw error;
        const obj = {};
        (data || []).forEach(r => { obj[r.date] = { articles: r.articles, words: r.words }; });
        return obj;
      }
      case 'lastread': {
        const { data, error } = await window.supabaseClient.from(info.table).select('*').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (!data || !data.article_id) return null;
        return { articleId: data.article_id, progress: data.progress, timestamp: data.timestamp };
      }
      case 'speeds': {
        const { data, error } = await window.supabaseClient.from(info.table).select('*').eq('user_id', userId);
        if (error) throw error;
        const obj = {};
        (data || []).forEach(r => { obj[r.date] = r.records || []; });
        return obj;
      }
      case 'focus': {
        const { data, error } = await window.supabaseClient.from(info.table).select('*').eq('user_id', userId).order('date', { ascending: false }).limit(100);
        if (error) throw error;
        return (data || []).map(r => ({
          date: r.date, duration: r.duration, articleId: r.article_id, partial: r.partial
        }));
      }
      case 'notes': {
        const { data, error } = await window.supabaseClient.from(info.table).select('*').eq('user_id', userId);
        if (error) throw error;
        const obj = {};
        (data || []).forEach(r => { obj[r.article_id] = r.notes || []; });
        return obj;
      }
      case 'settings': {
        const { data, error } = await window.supabaseClient.from(info.table).select('settings').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        return data?.settings || null;
      }
      case 'dailypick': {
        const { data, error } = await window.supabaseClient.from(info.table).select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1);
        if (error) throw error;
        if (!data || data.length === 0) return null;
        return { date: data[0].date, id: data[0].article_id };
      }
    }
    return null;
  },

  // ===== INTERNAL: PUSH TO SUPABASE =====
  async _push(key, value) {
    const info = this._map[key];
    const userId = Auth.user.id;

    switch (info.type) {
      case 'vocab': {
        // Delete all then re-insert (simplest for sync)
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        if (Array.isArray(value) && value.length > 0) {
          const rows = value.map(v => ({
            user_id: userId, word: v.word, phonetic: v.phonetic || '',
            definition: v.definition || '', added_at: v.addedAt || new Date().toISOString(),
            reviews: v.reviews || [], status: v.status || 'new'
          }));
          await window.supabaseClient.from(info.table).insert(rows);
        }
        break;
      }
      case 'idlist': {
        const col = info.col;
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        if (Array.isArray(value) && value.length > 0) {
          const rows = value.map(id => ({ user_id: userId, [col]: id }));
          await window.supabaseClient.from(info.table).insert(rows);
        }
        break;
      }
      case 'datelist': {
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        if (Array.isArray(value) && value.length > 0) {
          const rows = value.map(d => ({ user_id: userId, date: d }));
          await window.supabaseClient.from(info.table).insert(rows);
        }
        break;
      }
      case 'dailystats': {
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        if (value && typeof value === 'object') {
          const rows = Object.entries(value).map(([date, stat]) => ({
            user_id: userId, date, articles: stat.articles || 0, words: stat.words || 0
          }));
          if (rows.length > 0) await window.supabaseClient.from(info.table).insert(rows);
        }
        break;
      }
      case 'lastread': {
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        if (value && value.articleId) {
          await window.supabaseClient.from(info.table).insert({
            user_id: userId, article_id: value.articleId,
            progress: value.progress || 0, timestamp: value.timestamp || 0
          });
        }
        break;
      }
      case 'speeds': {
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        if (value && typeof value === 'object') {
          const rows = Object.entries(value).map(([date, records]) => ({
            user_id: userId, date, records
          }));
          if (rows.length > 0) await window.supabaseClient.from(info.table).insert(rows);
        }
        break;
      }
      case 'focus': {
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        const arr = Array.isArray(value) ? value.slice(0, 100) : [];
        if (arr.length > 0) {
          const rows = arr.map(s => ({
            user_id: userId, date: s.date, duration: s.duration,
            article_id: s.articleId || null, partial: s.partial || false
          }));
          await window.supabaseClient.from(info.table).insert(rows);
        }
        break;
      }
      case 'notes': {
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        if (value && typeof value === 'object') {
          const rows = Object.entries(value).map(([article_id, notes]) => ({
            user_id: userId, article_id, notes
          }));
          if (rows.length > 0) await window.supabaseClient.from(info.table).insert(rows);
        }
        break;
      }
      case 'settings': {
        await window.supabaseClient.from(info.table).delete().eq('user_id', userId);
        if (value) {
          await window.supabaseClient.from(info.table).insert({ user_id: userId, settings: value });
        }
        break;
      }
      case 'dailypick': {
        if (value && value.date) {
          await window.supabaseClient.from(info.table).upsert({
            user_id: userId, date: value.date, article_id: value.id
          }, { onConflict: 'user_id,date' });
        }
        break;
      }
    }
  },

  // ===== LOCAL STORAGE HELPERS =====
  _localGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  _localSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }
};
