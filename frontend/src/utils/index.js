export function createPageUrl(name) {
  const lower = String(name || '').toLowerCase();
  if (lower === 'home') return '/';
  return `/${lower}`;
}

// Auth intent helpers: store and retrieve a one-time action to perform after auth
export function setPostAuthIntent(intent) {
  try {
    localStorage.setItem('postAuthIntent', JSON.stringify(intent));
  } catch {}
}

export function consumePostAuthIntent() {
  try {
    const raw = localStorage.getItem('postAuthIntent');
    if (!raw) return null;
    localStorage.removeItem('postAuthIntent');
    return JSON.parse(raw);
  } catch {
    try { localStorage.removeItem('postAuthIntent'); } catch {}
    return null;
  }
}

export function getToken() {
  try { return localStorage.getItem('token'); } catch { return null; }
}

// Ensure a cart item is added to both the real user object and the demo_user mirror used by some pages
export function addItemToLocalCarts(cartItem) {
  try {
    // update 'user'
    const uRaw = localStorage.getItem('user');
    if (uRaw) {
      const u = JSON.parse(uRaw);
      const cart = Array.isArray(u.cart) ? u.cart : [];
      const exists = cart.some(ci => ci.item_id === cartItem.item_id && ci.item_type === cartItem.item_type);
      if (!exists) {
        const next = { ...u, cart: [...cart, cartItem] };
        localStorage.setItem('user', JSON.stringify(next));
      }
    }
  } catch {}
  try {
    // update 'demo_user' mirror
    const dRaw = localStorage.getItem('demo_user');
    const d = dRaw ? JSON.parse(dRaw) : {};
    const cart = Array.isArray(d.cart) ? d.cart : [];
    const exists = cart.some(ci => ci.item_id === cartItem.item_id && ci.item_type === cartItem.item_type);
    if (!exists) {
      d.cart = [...cart, cartItem];
      localStorage.setItem('demo_user', JSON.stringify(d));
    }
  } catch {}
}
export const Leaderboard = {
  async topN(itemType, itemId, n = 5) {
    const res = await fetch(`/api/leaderboard/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, n) : [];
  },
  async rank(itemType, itemId) {
    try {
      const userRaw = localStorage.getItem('user') || localStorage.getItem('demo_user');
      const user = userRaw ? JSON.parse(userRaw) : null;
      const uid = user?.id;
      if (!uid) return { rank: null };
      const res = await fetch(`/api/leaderboard/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}/rank/${encodeURIComponent(uid)}`);
      if (!res.ok) return { rank: null };
      return res.json();
    } catch {
      return { rank: null };
    }
  }
};
