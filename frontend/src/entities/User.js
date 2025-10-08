// Temporary stub for authentication until real implementation is pasted
export const User = {
  async me() {
    const user = JSON.parse(localStorage.getItem('demo_user') || 'null');
    if (!user) throw new Error('not logged in');
    return user;
  },
  async login() {
    // Minimal demo login: create fake user
    const user = { email: 'demo@example.com', full_name: 'Demo User', role: 'user', cart: [] };
    localStorage.setItem('demo_user', JSON.stringify(user));
    return user;
  },
  async logout() {
    localStorage.removeItem('demo_user');
  },
  async updateMyUserData(patch) {
    const user = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
    const updated = { ...user, ...patch };
    localStorage.setItem('demo_user', JSON.stringify(updated));
    return updated;
  },
};
