import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Song } from '@/entities/Song';
import { Card } from '@/components/ui/card';
import AudioPlayer from '@/components/media/AudioPlayer';

export default function SongDetails() {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState(null);
  const [purchased, setPurchased] = useState(false);
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
      const token = localStorage.getItem('token');
      let full = null;
      if (token) full = await Song.getSignedUrl(song.id, token);
      if (full) {
        setPurchased(true);
        setAudioUrl(full);
        return;
      }
      const prev = await Song.getPreviewUrl(song.id);
      setPurchased(false);
      setAudioUrl(prev || null);
    })();
  }, [song?.id]);

  if (loading) return <div className="max-w-2xl mx-auto py-16 text-center text-gray-400">Loading…</div>;
  if (!song) return <div className="max-w-2xl mx-auto py-16 text-center text-gray-400">Song not found</div>;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card className="p-6 flex flex-col items-center gap-6">
        <img src={song.cover_image || 'https://via.placeholder.com/160?text=%F0%9F%8E%B5'} alt={song.title} className="w-40 h-40 rounded-lg object-cover mb-2" />
        <h1 className="text-2xl font-bold text-white mb-1">{song.title}</h1>
        <div className="text-gray-400 mb-2">{song.artist}</div>
        {audioUrl ? (
          <AudioPlayer
            src={audioUrl}
            title={song.title}
            showPreviewBadge={!purchased}
            hasPrev={false}
            hasNext={false}
            loopMode={loopMode}
            onLoopModeChange={setLoopMode}
            embedded
          />
        ) : (
          <div className="w-full text-center text-xs text-gray-400">No preview available. Purchase to listen.</div>
        )}
  <div className="text-yellow-400 font-bold text-lg">From GH₵ {parseFloat(song.price)?.toFixed(2) || '0.00'}</div>
        <div className="w-full text-center text-sm text-gray-400 mt-2">Supporters can pay more than the minimum to support the creator — set your amount at checkout.</div>
        <div className="w-full flex gap-3 mt-4">
          <button onClick={async () => {
            const u = JSON.parse(localStorage.getItem('demo_user') || 'null');
            if (!u) { const { User } = await import('@/entities/User'); await User.login(); window.location.reload(); return; }
            // add to cart simple flow
            const cartItem = { item_type: 'song', item_id: song.id, title: song.title, price: Number(song.price||0), min_price: Number(song.price||0), image: song.cover_image };
            const u2 = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
            u2.cart = u2.cart || [];
            if (!u2.cart.some(i => i.item_id === song.id)) {
              u2.cart.push(cartItem);
              localStorage.setItem('demo_user', JSON.stringify(u2));
              window.location.href = '/cart';
            } else {
              window.location.href = '/cart';
            }
          }} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg">Add to Cart</button>
          <button onClick={() => window.location.href = `/songs/${encodeURIComponent(song.id)}` } className="flex-1 bg-slate-800 text-gray-300 py-3 rounded-lg">More Details</button>
        </div>
        {song.description && <div className="text-gray-300 mt-2">{song.description}</div>}
      </Card>
    </div>
  );
}
