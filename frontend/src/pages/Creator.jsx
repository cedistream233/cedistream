import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContentCard from '@/components/content/ContentCard';
import ContentRow from '@/components/content/ContentRow';
import { Song } from '@/entities/Song';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

export default function Creator() {
  const { id } = useParams();
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
        const res2 = await fetch(`/api/creators/${encodeURIComponent(id)}/content`);
        const data2 = res2.ok ? await res2.json() : { albums: [], videos: [] };
        setContent(data2);
  const singlesData = await Song.list({ user_id: id });
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
                    }}
                    type="song"
                    onAddToCart={() => {
                    // Add to cart at minimum price and redirect to cart (no prompt)
                    (async () => {
                      try {
                        const { User } = await import('@/entities/User');
                        let u = JSON.parse(localStorage.getItem('demo_user') || 'null');
                        if (!u) {
                          await User.login();
                          u = await User.me();
                        }
                        const minPrice = Number(song.price || 0);
                        const cartItem = {
                          item_type: 'song',
                          item_id: song.id,
                          title: song.title,
                          price: minPrice,
                          min_price: minPrice,
                          image: song.cover_image
                        };
                        const currentCart = u.cart || [];
                        const exists = currentCart.some(i => i.item_id === song.id);
                        if (!exists) {
                          await User.updateMyUserData({ cart: [...currentCart, cartItem] });
                        }
                        // redirect to cart to allow immediate checkout
                        window.location.href = '/cart';
                      } catch (e) {
                        console.error(e);
                        // best-effort fallback
                        try {
                          const u2 = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
                          const minPrice2 = Number(song.price || 0);
                          const cartItem2 = { item_type: 'song', item_id: song.id, title: song.title, price: minPrice2, min_price: minPrice2, image: song.cover_image };
                          u2.cart = u2.cart || [];
                          if (!u2.cart.some(i => i.item_id === song.id)) u2.cart.push(cartItem2);
                          localStorage.setItem('demo_user', JSON.stringify(u2));
                          localStorage.setItem('user', JSON.stringify(u2));
                        } catch {}
                        window.location.href = '/cart';
                      }
                    })();
                    }}
                    onViewDetails={() => window.location.href = `/songs/${encodeURIComponent(song.id)}`}
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
                <ContentCard key={album.id} item={album} type="album" onViewDetails={() => window.location.href = `/albums/${encodeURIComponent(album.id)}`} />
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
                  item={video}
                  type="video"
                  onViewDetails={() => { window.location.href = `/videos?id=${encodeURIComponent(video.id)}`; }}
                />
              ))}
            </div>
          )}
        </section>)}
      </div>
    </div>
  );
}
