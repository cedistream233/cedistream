// Lightweight auth helper that cooperates with AuthContext and supports both
// authenticated ('user' + 'token') and demo/anonymous ('demo_user') modes.
export const User = {
  async me() {
    // Prefer the real authenticated user, fall back to demo_user for anonymous/demo flows
    const raw = localStorage.getItem('user') || localStorage.getItem('demo_user');
    const user = raw ? JSON.parse(raw) : null;
    if (!user) throw new Error('not logged in');
    return user;
  },
  async login() {
    // Minimal demo login: create fake user in demo mode
    const user = { email: 'demo@example.com', full_name: 'Demo User', role: 'user', cart: [] };
    try { localStorage.setItem('demo_user', JSON.stringify(user)); } catch {}
    // Also mirror to 'user' so UI that reads 'user' continues to work in demo
    try { localStorage.setItem('user', JSON.stringify(user)); } catch {}
    return user;
  },
  async logout() {
    try { localStorage.removeItem('demo_user'); } catch {}
    // Do not clear 'user' or 'token' here; AuthContext.logout should handle real sessions
  },
  async updateMyUserData(patch) {
    // If a token exists, update the real 'user'; otherwise, update 'demo_user' and mirror to 'user' for UI
    const hasToken = !!(localStorage.getItem('token'));
    if (hasToken) {
      const base = JSON.parse(localStorage.getItem('user') || 'null') || {};
      const updated = { ...base, ...patch };
      try { localStorage.setItem('user', JSON.stringify(updated)); } catch {}
      return updated;
    } else {
      const base = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
      const updated = { ...base, ...patch };
      try { localStorage.setItem('demo_user', JSON.stringify(updated)); } catch {}
      // Mirror to 'user' so components relying on it update in demo mode
      try { localStorage.setItem('user', JSON.stringify(updated)); } catch {}
      return updated;
    }
  },
};
