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
    const res = await fetch(`/api/videos?orderBy=${encodeURIComponent(field)}&direction=${encodeURIComponent(direction)}`);
    if (!res.ok) return [];
    return res.json();
  },
  async get(id) {
    const res = await fetch(`/api/videos/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return res.json();
  },
};

export default VideoSchema;