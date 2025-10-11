import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Song } from '@/entities/Song';
import { Card } from '@/components/ui/card';
import AudioPlayer from '@/components/media/AudioPlayer';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

export default function SongDetails() {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState(null);
  const [purchased, setPurchased] = useState(false);
  const [audioFetching, setAudioFetching] = useState(true);
  const [loopMode, setLoopMode] = useState('off'); // 'off' | 'one' | 'all'

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await Song.get(id);
      setSong(data);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      if (!song?.id) return;
      setAudioFetching(true);
      try {
        const token = localStorage.getItem('token');
        let full = null;
        if (token) full = await Song.getSignedUrl(song.id, token);
        if (full) {
          setPurchased(true);
          setAudioUrl(full);
          return;
        }
        // Prefer a prefetched preview URL if available (stored in sessionStorage by the preview button)
        let pref = null;
        try { pref = sessionStorage.getItem(`preview:${song.id}`); } catch {}
        if (pref) {
          setPurchased(false);
          setAudioUrl(pref);
          // clear the prefetched value to avoid stale urls later
          try { sessionStorage.removeItem(`preview:${song.id}`); } catch {}
          return;
        }
        const prev = await Song.getPreviewUrl(song.id);
        setPurchased(false);
        setAudioUrl(prev || null);
      } finally { setAudioFetching(false); }
    })();
  }, [song?.id]);

  if (loading) return <LoadingOverlay text="Loading" />;
  if (!song) return <div className="max-w-2xl mx-auto py-16 text-center text-gray-400">Song not found</div>;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card className="p-6 flex flex-col items-center gap-6">
        <img src={song.cover_image || 'https://via.placeholder.com/160?text=%F0%9F%8E%B5'} alt={song.title} className="w-40 h-40 rounded-lg object-cover mb-2" />
        <h1 className="text-2xl font-bold text-white mb-1">{song.title}</h1>
        <div className="text-gray-400 mb-2">{song.artist}</div>
        {/* Render the player immediately; pass loading while the audio URL is being resolved */}
        <AudioPlayer
          src={audioUrl}
          loading={audioFetching}
          title={song.title}
          showPreviewBadge={!purchased}
          hasPrev={false}
          hasNext={false}
          loopMode={loopMode}
          onLoopModeChange={setLoopMode}
          embedded
        />
  <div className="text-sm text-gray-300">Pay what you want • Min GH₵ {parseFloat(song.price)?.toFixed(2) || '0.00'}</div>
    <div className="w-full text-center text-sm text-gray-400 mt-2">You can choose to pay more to support the creator. Minimum applies.</div>
        <div className="w-full flex gap-3 mt-4">
          <button onClick={async () => {
            const u = JSON.parse(localStorage.getItem('demo_user') || 'null');
            if (!u) { const { User } = await import('@/entities/User'); await User.login(); window.location.href = '/cart'; return; }
            // add to cart simple flow with minimum price and redirect to cart
            const cartItem = { item_type: 'song', item_id: song.id, title: song.title, price: Number(song.price||0), min_price: Number(song.price||0), image: song.cover_image };
            const u2 = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
            u2.cart = u2.cart || [];
            if (!u2.cart.some(i => i.item_id === song.id)) {
              u2.cart.push(cartItem);
              localStorage.setItem('demo_user', JSON.stringify(u2));
            }
            window.location.href = '/cart';
          }} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg">Add to Cart</button>
        </div>
        {song.description && <div className="text-gray-300 mt-2">{song.description}</div>}
      </Card>
    </div>
  );
}
