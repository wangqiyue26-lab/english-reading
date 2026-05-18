/* ============================================
   AuthUI — Auth overlay display and form handling
   ============================================ */

const AuthUI = {
  _mode: 'login', // login | register | reset | newpassword

  init() {
    this._bindOverlayClick();
    this._bindTabs();
    this._bindForms();
    this._checkRecoveryFlow();
  },

  // ===== OPEN / CLOSE =====
  open(mode) {
    if (mode) this._switchMode(mode);
    else this._switchMode('login');
    document.getElementById('auth-overlay').classList.add('open');
    this._clearErrors();
    this._clearInfos();
    document.querySelectorAll('.auth-input').forEach(el => { el.value = ''; });
  },

  close() {
    document.getElementById('auth-overlay').classList.remove('open');
  },

  // ===== OVERLAY BACKGROUND CLICK =====
  _bindOverlayClick() {
    document.getElementById('auth-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });
    document.getElementById('auth-close').addEventListener('click', () => this.close());

    document.getElementById('btn-forgot-password').addEventListener('click', () => {
      this._switchMode('reset');
    });
    document.getElementById('btn-back-to-login').addEventListener('click', () => {
      this._switchMode('login');
    });
  },

  // ===== TABS =====
  _bindTabs() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.getAttribute('data-tab');
        this._switchMode(tabName);
      });
    });
  },

  _switchMode(mode) {
    this._mode = mode;
    // Update tab active state
    document.querySelectorAll('.auth-tab').forEach(t => {
      const tm = t.getAttribute('data-tab');
      t.classList.toggle('active', tm === mode && (tm === 'login' || tm === 'register'));
    });
    // Show/hide tabs
    const tabsEl = document.getElementById('auth-tabs');
    tabsEl.style.display = (mode === 'login' || mode === 'register') ? '' : 'none';

    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    // Show target form
    const formMap = {
      login: 'auth-form-login',
      register: 'auth-form-register',
      reset: 'auth-form-reset',
      newpassword: 'auth-form-new-password'
    };
    const formEl = document.getElementById(formMap[mode]);
    if (formEl) {
      formEl.classList.add('active');
      // Focus first input
      const firstInput = formEl.querySelector('input');
      if (firstInput) setTimeout(() => firstInput.focus(), 200);
    }

    this._clearErrors();
    this._clearInfos();
  },

  // ===== FORM BINDING =====
  _bindForms() {
    const forms = ['auth-form-login', 'auth-form-register', 'auth-form-reset', 'auth-form-new-password'];
    const handlers = ['_handleLogin', '_handleRegister', '_handleResetPassword', '_handleNewPassword'];

    forms.forEach((id, i) => {
      const form = document.getElementById(id);
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          console.log('AuthUI: submit', id);
          this[handlers[i]]();
        });
      } else {
        console.error('AuthUI: form not found', id);
      }
    });
  },

  // ===== LOGIN =====
  async _handleLogin() {
    this._clearErrors();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    let valid = true;
    if (!email) { this._showError('login-email-error', 'Email is required'); valid = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { this._showError('login-email-error', 'Invalid email format'); valid = false; }
    if (!password) { this._showError('login-password-error', 'Password is required'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('login-submit');
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
      await Auth.login(email, password);
      this.close();
      App.toast('Logged in successfully');
    } catch (err) {
      this._showError('login-general-error', this._friendlyError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Log In';
    }
  },

  // ===== REGISTER =====
  async _handleRegister() {
    console.log('AuthUI: _handleRegister called');
    this._clearErrors();
    this._clearInfos();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    console.log('AuthUI: inputs', { username, email, passwordLen: password.length });

    let valid = true;
    if (!username || username.length < 2) { this._showError('reg-username-error', 'Username must be at least 2 characters'); valid = false; }
    if (!email) { this._showError('reg-email-error', 'Email is required'); valid = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { this._showError('reg-email-error', 'Invalid email format'); valid = false; }
    if (!password || password.length < 6) { this._showError('reg-password-error', 'Password must be at least 6 characters'); valid = false; }
    if (password !== confirm) { this._showError('reg-confirm-error', 'Passwords do not match'); valid = false; }
    if (!valid) { console.log('AuthUI: validation failed'); return; }
    if (typeof Auth === 'undefined' || typeof Auth.register !== 'function') {
      this._showError('reg-general-error', 'Authentication is not available right now. Please refresh and try again.');
      return;
    }

    const btn = document.getElementById('reg-submit');
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    console.log('AuthUI: calling Auth.register');

    try {
      const result = await Auth.register(email, password, username);
      console.log('AuthUI: register success', result);
      document.getElementById('reg-info').innerHTML = 'Check your email for a verification link. After verifying, you can log in.';
      // Clear form
      document.querySelectorAll('#auth-form-register .auth-input').forEach(el => { el.value = ''; });
      setTimeout(() => this._switchMode('login'), 4000);
    } catch (err) {
      console.error('AuthUI: register error', err);
      this._showError('reg-general-error', this._friendlyError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  },

  // ===== RESET PASSWORD =====
  async _handleResetPassword() {
    this._clearErrors();
    this._clearInfos();
    const email = document.getElementById('reset-email').value.trim();

    if (!email) { this._showError('reset-email-error', 'Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { this._showError('reset-email-error', 'Invalid email format'); return; }

    const btn = document.getElementById('reset-submit');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      await Auth.resetPassword(email);
      document.getElementById('reset-info').innerHTML = 'Check your email for a password reset link.';
      document.getElementById('reset-email').value = '';
    } catch (err) {
      this._showError('reset-general-error', this._friendlyError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Reset Link';
    }
  },

  // ===== NEW PASSWORD (after recovery) =====
  async _handleNewPassword() {
    this._clearErrors();
    this._clearInfos();
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('new-confirm').value;

    let valid = true;
    if (!password || password.length < 6) { this._showError('new-password-error', 'Password must be at least 6 characters'); valid = false; }
    if (password !== confirm) { this._showError('new-confirm-error', 'Passwords do not match'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('new-password-submit');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
      await Auth.updatePassword(password);
      document.getElementById('new-password-info').innerHTML = 'Password updated! You can now log in.';
      setTimeout(() => this._switchMode('login'), 2500);
    } catch (err) {
      this._showError('new-password-general-error', this._friendlyError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  },

  // ===== RECOVERY FLOW DETECTION =====
  _checkRecoveryFlow() {
    // Supabase redirects with type=recovery in the URL hash
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('error=access_denied'))) {
      // Supabase SDK handles the token exchange automatically via detectSessionInUrl
      // We just need to show the new password form if the user is authenticated
      setTimeout(() => {
        if (Auth.isLoggedIn) {
          this.open('newpassword');
        }
      }, 1000);
    }

    // Check ?reset query param (our custom flow)
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === '') {
      history.replaceState({}, '', window.location.pathname);
      setTimeout(() => {
        if (Auth.isLoggedIn) {
          this.open('newpassword');
        } else {
          this.open('login');
        }
      }, 500);
    }
  },

  // ===== HELPERS =====
  _showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = ''; }
  },

  _clearErrors() {
    document.querySelectorAll('.auth-error').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
  },

  _clearInfos() {
    document.querySelectorAll('.auth-info').forEach(el => { el.textContent = ''; });
  },

  _friendlyError(err) {
    if (!err) return 'Unknown error';
    const msg = typeof err === 'string' ? err : (err.message || err.error_description || 'Unknown error');
    // Map Supabase errors to friendly messages
    if (msg.includes('Invalid login credentials')) return 'Invalid email or password';
    if (msg.includes('already registered') || msg.includes('already exists')) return 'An account with this email already exists';
    if (msg.includes('valid email')) return 'Please enter a valid email';
    if (msg.includes('password')) return 'Password is too weak';
    if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts. Please wait a moment.';
    if (msg.includes('not confirmed')) return 'Please check your email and verify your account first';
    return msg;
  }
};
