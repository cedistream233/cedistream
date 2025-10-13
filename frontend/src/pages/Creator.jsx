import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContentCard from '@/components/content/ContentCard';
import ContentRow from '@/components/content/ContentRow';
import { setPostAuthIntent } from '@/utils';
import { Song } from '@/entities/Song';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

export default function Creator() {
  const { handle: id } = useParams();
  const [tab, setTab] = useState('songs'); // 'songs' | 'albums' | 'videos'
  const [creator, setCreator] = useState(null);
  const [content, setContent] = useState({ albums: [], videos: [] });
  const [singles, setSingles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/creators/${encodeURIComponent(id)}`);
    const data = res.ok ? await res.json() : null;
    setCreator(data);
    const resolvedId = data?.user_id || id;
    const res2 = await fetch(`/api/creators/${encodeURIComponent(id)}/content`);
    const data2 = res2.ok ? await res2.json() : { albums: [], videos: [] };
    setContent(data2);
  const singlesData = await Song.list({ user_id: resolvedId });
  // only show standalone singles (exclude songs that are part of albums)
  const onlySingles = Array.isArray(singlesData) ? singlesData.filter(s => !s.album_id) : [];
  setSingles(onlySingles);
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <LoadingOverlay text="Loading creator" />;

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

      {/* Top horizontal filter */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto">
        {['songs','albums','videos'].map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg capitalize whitespace-nowrap ${tab===k ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white hover:bg-purple-900/30'}`}
          >{k}</button>
        ))}
      </div>

      <div className="space-y-10">
        {tab === 'songs' && (
          <section>
            <h2 className="text-xl text-white mb-4">Singles</h2>
            {singles.length === 0 ? (
              <div className="text-gray-400">No singles yet</div>
            ) : (
              <div className="space-y-3">
                {singles.map((song) => (
                  <ContentRow
                    key={song.id}
                    item={{
                      id: song.id,
                      title: song.title,
                      artist: song.artist,
                      price: song.price,
                      cover_image: song.cover_image,
                      release_date: song.release_date || song.published_at || song.created_at || null,
                    }}
                    type="song"
                    onAddToCart={() => {
                      (async () => {
                        const token = localStorage.getItem('token');
                        const min = Number(song.price || 0);
                        if (!token) {
                          setPostAuthIntent({
                            action: 'add-to-cart',
                            item: { item_type: 'song', item_id: song.id, title: song.title, price: min, min_price: min, image: song.cover_image },
                            redirect: '/cart'
                          });
                          window.location.href = '/signup';
                          return;
                        }
                        try {
                          const uRaw = localStorage.getItem('user');
                          const u = uRaw ? JSON.parse(uRaw) : {};
                          const cart = Array.isArray(u.cart) ? u.cart : [];
                          const exists = cart.some(i => i.item_id === song.id && i.item_type === 'song');
                          if (!exists) {
                            const next = { ...u, cart: [...cart, { item_type: 'song', item_id: song.id, title: song.title, price: min, min_price: min, image: song.cover_image }] };
                            localStorage.setItem('user', JSON.stringify(next));
                            try { localStorage.setItem('demo_user', JSON.stringify(next)); } catch {}
                          }
                        } catch {}
                        window.location.href = '/cart';
                      })();
                    }}
                    onViewDetails={() => window.location.href = `/songs/${encodeURIComponent(song.id)}`}
                    showPwyw={false}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'albums' && (<section>
          <h2 className="text-xl text-white mb-4">Albums</h2>
          {content.albums.length === 0 ? (
            <div className="text-gray-400">No albums yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {content.albums.map((album) => (
                <ContentCard key={album.id} item={{ ...album, release_date: album.release_date || album.published_at || album.created_at || null }} type="album" onViewDetails={() => window.location.href = `/albums/${encodeURIComponent(album.id)}`} showPwyw={false} />
              ))}
            </div>
          )}
        </section>)}

        {tab === 'videos' && (<section>
          <h2 className="text-xl text-white mb-4">Videos</h2>
          {content.videos.length === 0 ? (
            <div className="text-gray-400">No videos yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {content.videos.map((video) => (
                <ContentCard
                  key={video.id}
                  item={{ ...video, release_date: video.release_date || video.published_at || video.created_at || null }}
                  type="video"
                  onViewDetails={() => { window.location.href = `/videos?id=${encodeURIComponent(video.id)}`; }}
                  showPwyw={false}
                />
              ))}
            </div>
          )}
        </section>)}
      </div>
    </div>
  );
}
