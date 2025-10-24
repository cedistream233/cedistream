import { config } from '@/utils/config';

export const AlbumSchema = {
  name: "Album",
  type: "object",
  properties: {
    title: { type: "string", description: "Album title" },
    artist: { type: "string", description: "Artist or band name" },
    description: { type: "string", description: "Album description" },
    price: { type: "number", description: "Price in GHS (Ghana Cedis)" },
    cover_image: { type: "string", description: "Album cover image URL" },
    release_date: { type: "string", format: "date", description: "Release date" },
    genre: {
      type: "string",
      enum: [
        "Afrobeats",
        "Hip Hop",
        "Gospel",
        "Highlife",
        "R&B",
        "Reggae",
        "Pop",
        "Other"
      ],
      description: "Music genre",
    },
    songs: {
      type: "array",
      description: "List of songs in the album",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          duration: { type: "string" },
          audio_url: { type: "string" },
        },
      },
    },
  },
  required: ["title", "artist", "price"],
};

const mapOrder = (orderBy) => {
  if (!orderBy) return { orderBy: 'created_at', direction: 'desc' };
  const desc = orderBy.startsWith('-');
  const field = orderBy.replace(/^-/, '').replace('created_date', 'created_at');
  return { orderBy: field, direction: desc ? 'desc' : 'asc' };
};

export const Album = {
  async list(orderBy = '-created_date') {
    const { orderBy: field, direction } = mapOrder(orderBy);
    const res = await fetch(`${config.backendUrl}/api/albums?orderBy=${encodeURIComponent(field)}&direction=${encodeURIComponent(direction)}`);
    if (!res.ok) return [];
    return res.json();
  },
  async get(id) {
    const res = await fetch(`${config.backendUrl}/api/albums/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },
  async update(id, patch = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.backendUrl}/api/albums/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) return null;
    return res.json();
  }
};

export default AlbumSchema;