import { config } from '@/utils/config';

async function getPreviewUrl(id) {
  const path = `/api/media/song/${encodeURIComponent(id)}/preview`;
  const url = `${config.backendUrl}${path}`;
  try {
    let res = await fetch(url);
    // If 404, treat as 'no preview' and return null (not an error)
    if (res.status === 404) return null;
    if (!res.ok) {
      // retry once for transient errors
      try { res = await fetch(url); } catch (e) { /* ignore */ }
      if (!res || !res.ok) return null;
    }
    const data = await res.json();
    return data?.url || null;
  } catch (err) {
    console.warn('getPreviewUrl failed:', err?.message || err);
    return null;
  }
}

async function getSignedUrl(id, token) {
  const path = `/api/media/song/${id}`;
  const url = `${config.backendUrl}${path}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url || null;
  } catch (err) {
    console.warn('getSignedUrl failed:', err?.message || err);
    return null;
  }
}
export const SongSchema = {
  name: "Song",
  type: "object",
  properties: {
    title: { type: "string" },
    artist: { type: "string" },
    description: { type: "string" },
    price: { type: "number" },
    cover_image: { type: "string" },
    audio_url: { type: "string" },
    duration: { type: "string" },
    release_date: { type: "string", format: "date" },
  },
  required: ["title", "price"],
};

const mapOrder = (orderBy) => {
  if (!orderBy) return { orderBy: 'created_at', direction: 'desc' };
  const desc = orderBy.startsWith('-');
  const field = orderBy.replace(/^-/, '').replace('created_date', 'created_at');
  return { orderBy: field, direction: desc ? 'desc' : 'asc' };
};

export const Song = {
  async list(params = {}) {
    const { orderBy = '-created_date', user_id, album_id, q } = params;
    const { orderBy: field, direction } = mapOrder(orderBy);
    const qs = new URLSearchParams();
    qs.set('orderBy', field);
    qs.set('direction', direction);
    if (user_id) qs.set('user_id', user_id);
    if (album_id) qs.set('album_id', album_id);
    if (q) qs.set('q', q);
    const res = await fetch(`/api/songs?${qs.toString()}`);
    if (!res.ok) return [];
    return res.json();
  },
  async get(id) {
    const res = await fetch(`/api/songs/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },
  async update(id, patch = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/songs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) return null;
    return res.json();
  },
  getPreviewUrl,
  getSignedUrl
};

export default SongSchema;
