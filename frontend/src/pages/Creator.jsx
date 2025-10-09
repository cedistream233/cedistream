import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContentCard from '@/components/content/ContentCard';

export default function Creator() {
  const { id } = useParams();
  const [creator, setCreator] = useState(null);
  const [content, setContent] = useState({ albums: [], videos: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/creators/${encodeURIComponent(id)}`);
        const data = res.ok ? await res.json() : null;
        setCreator(data);
        const res2 = await fetch(`/api/creators/${encodeURIComponent(id)}/content`);
        const data2 = res2.ok ? await res2.json() : { albums: [], videos: [] };
        setContent(data2);
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-800 rounded w-64" />
          <div className="h-5 bg-slate-800 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!creator) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-400">Creator not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <img src={creator.profile_image || 'https://via.placeholder.com/96?text=%F0%9F%8E%B5'} alt={creator.display_name} className="w-20 h-20 rounded-full object-cover" />
        <div>
          <h1 className="text-3xl font-bold text-white">{creator.display_name}</h1>
          {creator.bio && <p className="text-gray-400">{creator.bio}</p>}
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <h2 className="text-xl text-white mb-4">Albums</h2>
          {content.albums.length === 0 ? (
            <div className="text-gray-400">No albums yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {content.albums.map((album) => (
                <ContentCard key={album.id} item={album} type="album" />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl text-white mb-4">Videos</h2>
          {content.videos.length === 0 ? (
            <div className="text-gray-400">No videos yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {content.videos.map((video) => (
                <ContentCard key={video.id} item={video} type="video" />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
