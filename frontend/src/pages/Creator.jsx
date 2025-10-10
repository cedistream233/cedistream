import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContentCard from '@/components/content/ContentCard';
import { Song } from '@/entities/Song';

export default function Creator() {
  const { id } = useParams();
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
        setSingles(singlesData);
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
          <h2 className="text-xl text-white mb-4">Singles</h2>
          {singles.length === 0 ? (
            <div className="text-gray-400">No singles yet</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {singles.map((song) => (
                <ContentCard
                  key={song.id}
                  item={{
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    price: song.price,
                    cover_image: song.cover_image,
                    audio_url: song.audio_url,
                    songs: []
                  }}
                  type="album"
                  onAddToCart={() => {
                    // open ChooseAmountModal via simple flow used in Albums/Videos: emulate adding to cart by triggering login or modal
                    (async () => {
                      try {
                        const u = JSON.parse(localStorage.getItem('demo_user') || 'null');
                        if (!u) {
                          // quick login
                          const { User } = await import('@/entities/User');
                          await User.login();
                          // after login redirect to cart so user can checkout
                          window.location.href = '/cart';
                          return;
                        }
                        // show simple choose amount prompt
                        const amount = prompt(`Enter amount to pay (minimum GH₵ ${Number(song.price||0).toFixed(2)}):`, String(song.price||0));
                        if (amount === null) return;
                        const chosen = Math.max(Number(song.price||0), Number(amount||0));
                        const cartItem = {
                          item_type: 'song',
                          item_id: song.id,
                          title: song.title,
                          price: chosen,
                          min_price: Number(song.price||0),
                          image: song.cover_image
                        };
                        const u2 = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
                        const currentCart = u2.cart || [];
                        const exists = currentCart.some(i => i.item_id === song.id);
                        if (!exists) {
                          u2.cart = [...currentCart, cartItem];
                          localStorage.setItem('demo_user', JSON.stringify(u2));
                          // redirect to cart to allow immediate checkout
                          window.location.href = '/cart';
                        } else {
                          window.location.href = '/cart';
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    })();
                  }}
                  onViewDetails={() => window.location.href = `/songs/${encodeURIComponent(song.id)}`}
                />
              ))}
            </div>
          )}
        </section>

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
