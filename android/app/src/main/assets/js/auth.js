/* ============================================
   Auth — Login, Register, Password Reset, Sessions
   ============================================ */

const Auth = {
  _user: null,
  _session: null,

  async init() {
    try {
      const client = window.supabaseClient;
      if (!client) throw new Error('Supabase client not initialized');
      console.log('Auth.init: checking session...');
      const { data } = await client.auth.getSession();
      this._session = data.session;
      this._user = data.session?.user ?? null;
      console.log('Auth.init: session', this._user ? 'found' : 'none');

      client.auth.onAuthStateChange((event, session) => {
        console.log('Auth: state change', event);
        this._session = session;
        this._user = session?.user ?? null;
        this._onStateChange(event);
      });
    } catch (e) {
      console.error('Auth.init failed:', e);
    }
  },

  get user() { return this._user; },
  get isLoggedIn() { return !!this._user; },
  get username() { return this._user?.user_metadata?.username || this._user?.email || ''; },

  // ===== LOGIN =====
  async login(email, password) {
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // ===== REGISTER =====
  async register(email, password, username) {
    const { data, error } = await window.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });
    if (error) throw error;
    return data;
  },

  // ===== RESEND VERIFICATION EMAIL =====
  async resendVerification(email) {
    const { data, error } = await window.supabaseClient.auth.resend({
      type: 'signup',
      email
    });
    if (error) throw error;
    return data;
  },

  // ===== PASSWORD RESET =====
  async resetPassword(email) {
    const { data, error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + '?reset'
    });
    if (error) throw error;
    return data;
  },

  // ===== UPDATE PASSWORD (after reset) =====
  async updatePassword(newPassword) {
    const { data, error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },

  // ===== LOGOUT =====
  async logout() {
    const { error } = await window.supabaseClient.auth.signOut();
    if (error) throw error;
    this._user = null;
    this._session = null;
  },

  // ===== STATE CHANGE HANDLER =====
  _onStateChange(event) {
    switch (event) {
      case 'SIGNED_IN':
        this._onSignIn();
        break;
      case 'SIGNED_OUT':
        this._onSignOut();
        break;
      case 'USER_UPDATED':
        // Profile/password updated
        break;
    }
  },

  _onSignIn() {
    // Check if there's local data to migrate
    Sync.migrateIfNeeded();
    this._updateUI();
  },

  _onSignOut() {
    Sync.clearCache();
    this._updateUI();
    if (App && App.renderHome) App.renderHome();
  },

  _updateUI() {
    const profileBtn = document.getElementById('btn-profile');
    const userDisplay = document.getElementById('user-display');

    if (this.isLoggedIn) {
      if (profileBtn) profileBtn.title = this.username;
      if (userDisplay) {
        userDisplay.textContent = this.username;
        userDisplay.style.display = '';
      }
    } else {
      if (profileBtn) profileBtn.title = 'Profile';
      if (userDisplay) {
        userDisplay.textContent = '';
        userDisplay.style.display = 'none';
      }
    }
  }
};
