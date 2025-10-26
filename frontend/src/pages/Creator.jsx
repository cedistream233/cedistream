import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ContentCard from '@/components/content/ContentCard';
import ContentRow from '@/components/content/ContentRow';
import { setPostAuthIntent } from '@/utils';
import { Song } from '@/entities/Song';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { Search } from 'lucide-react';

export default function Creator() {
  const { handle: id } = useParams();
  const [tab, setTab] = useState('songs'); // 'songs' | 'albums' | 'videos'
  const [creator, setCreator] = useState(null);
  const [content, setContent] = useState({ albums: [], videos: [] });
  const [singles, setSingles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const q = (search || '').trim().toLowerCase();
  const filteredSingles = q ? singles.filter(s => ((s.title||'').toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q))) : singles;
  const filteredAlbums = q ? content.albums.filter(a => ((a.title||'').toLowerCase().includes(q) || (a.artist||'').toLowerCase().includes(q))) : content.albums;
  const filteredVideos = q ? content.videos.filter(v => ((v.title||'').toLowerCase().includes(q) || (v.creator||'').toLowerCase().includes(q))) : content.videos;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const res = await fetch(`/api/creators/${encodeURIComponent(id)}`, { headers });
        const data = res.ok ? await res.json() : null;
        setCreator(data);

        const res2 = await fetch(`/api/creators/${encodeURIComponent(id)}/content`, { headers });
        const data2 = res2.ok ? await res2.json() : { albums: [], videos: [], songs: [] };
        setContent(data2);

        // Use songs from the content endpoint (now includes owned_by_me)
        // Filter to only show standalone singles (exclude songs that are part of albums)
        const onlySingles = Array.isArray(data2.songs) ? data2.songs.filter(s => !s.album_id) : [];
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

      {/* Search bar for creator content */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            aria-label="Search creator's content"
            placeholder="Search this creator (title, artist or creator)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-md bg-slate-800/60 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>
        {search ? (
          <button onClick={() => setSearch('')} className="text-sm text-gray-400 hover:text-white">Clear</button>
        ) : null}
      </div>

      <div className="space-y-6">
        {tab === 'songs' && (
          <section>
            <h2 className="text-xl text-white mb-4">Singles</h2>
            {(!q && singles.length === 0) ? (
              <div className="text-gray-400">No singles yet</div>
            ) : filteredSingles.length === 0 ? (
              <div className="text-center py-8"><p className="text-gray-400">No results</p></div>
            ) : (
              <div className="rounded-lg bg-slate-900/50 border border-purple-900/20 overflow-hidden divide-y divide-slate-800">
                {filteredSingles.map((song) => (
                  <ContentRow
                    key={song.id}
                    noCard={true}
                    item={{
                      id: song.id,
                      title: song.title,
                      // hide artist on creator listing rows
                      artist: '',
                      price: song.price,
                      cover_image: song.cover_image,
                      release_date: song.release_date || song.published_at || song.created_at || null,
                      owned_by_me: song.owned_by_me,
                    }}
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
          {(!q && content.albums.length === 0) ? (
            <div className="text-gray-400">No albums yet</div>
          ) : (filteredAlbums.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-400">No results</p></div>
          ) : (
            <div className="rounded-lg bg-slate-900/50 border border-purple-900/20 overflow-hidden divide-y divide-slate-800">
              {filteredAlbums.map((album) => (
                <ContentRow
                  key={album.id}
                  noCard={true}
                  item={{
                    id: album.id,
                    title: album.title,
                    artist: album.artist || '',
                    price: album.price,
                    cover_image: album.cover_image || album.thumbnail,
                    release_date: album.release_date || album.published_at || album.created_at || null,
                    owned_by_me: album.owned_by_me,
                    songs: album.songs,
                  }}
                  type="album"
                  onViewDetails={() => window.location.href = `/albums/${encodeURIComponent(album.id)}`}
                  showPwyw={false}
                />
              ))}
            </div>
          ))}
        </section>)}

        {tab === 'videos' && (<section>
          <h2 className="text-xl text-white mb-4">Videos</h2>
          {(!q && content.videos.length === 0) ? (
            <div className="text-gray-400">No videos yet</div>
          ) : (filteredVideos.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-400">No results</p></div>
          ) : (
            <div className="rounded-lg bg-slate-900/50 border border-purple-900/20 overflow-hidden divide-y divide-slate-800">
              {filteredVideos.map((video) => (
                <ContentRow
                  key={video.id}
                  noCard={true}
                  item={{
                    id: video.id,
                    title: video.title,
                    artist: video.creator || '',
                    price: video.price,
                    cover_image: video.cover_image || video.thumbnail,
                    release_date: video.release_date || video.published_at || video.created_at || null,
                    owned_by_me: video.owned_by_me,
                  }}
                  type="video"
                  onViewDetails={() => { window.location.href = `/videos/${encodeURIComponent(video.id)}`; }}
                  showPwyw={false}
                />
              ))}
            </div>
          ))}
        </section>)}
      </div>
    </div>
  );
}
