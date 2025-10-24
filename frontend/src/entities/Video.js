import { config } from '@/utils/config';

export const VideoSchema = {
  name: "Video",
  type: "object",
  properties: {
    title: { type: "string", description: "Video title" },
    creator: { type: "string", description: "Content creator or artist name" },
    description: { type: "string", description: "Video description" },
    price: { type: "number", description: "Price in GHS (Ghana Cedis)" },
    thumbnail: { type: "string", description: "Video thumbnail URL" },
    video_url: { type: "string", description: "Video file URL" },
    duration: { type: "string", description: "Video duration (e.g., '3:45')" },
    category: {
      type: "string",
      enum: [
        "Music Video",
        "Tutorial",
        "Entertainment",
        "Documentary",
        "Vlog",
        "Other",
      ],
      description: "Video category",
    },
    release_date: { type: "string", format: "date" },
  },
  required: ["title", "creator", "price"],
};

const mapOrder = (orderBy) => {
  if (!orderBy) return { orderBy: 'created_at', direction: 'desc' };
  const desc = orderBy.startsWith('-');
  const field = orderBy.replace(/^-/, '').replace('created_date', 'created_at');
  return { orderBy: field, direction: desc ? 'desc' : 'asc' };
};

export const Video = {
  async list(orderBy = '-created_date') {
    const { orderBy: field, direction } = mapOrder(orderBy);
    const res = await fetch(`${config.backendUrl}/api/videos?orderBy=${encodeURIComponent(field)}&direction=${encodeURIComponent(direction)}`);
    if (!res.ok) return [];
    return res.json();
  },
  async get(id) {
    const res = await fetch(`${config.backendUrl}/api/videos/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },
  async getPreviewUrl(id) {
    const path = `/api/media/video/${encodeURIComponent(id)}/preview`;
    const url = `${config.backendUrl}${path}`;
    try {
      let res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) {
        try { res = await fetch(url); } catch (e) { /* ignore */ }
        if (!res || !res.ok) return null;
      }
      const data = await res.json();
      return data?.url || null;
    } catch (err) {
      console.warn('getVideoPreviewUrl failed:', err?.message || err);
      return null;
    }
  }
};

export default VideoSchema;