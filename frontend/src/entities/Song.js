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
  }
};

export default SongSchema;
