import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Song } from '@/entities/Song';
import { Card } from '@/components/ui/card';
import AudioPlayer from '@/components/media/AudioPlayer';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import PriceEditModal, { PriceDisplay } from '@/components/ui/PriceEditModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export default function SongDetails() {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fullUrl, setFullUrl] = useState(null);
  const [purchased, setPurchased] = useState(false);
  const [audioFetching, setAudioFetching] = useState(true);
  const [loopMode, setLoopMode] = useState('off'); // 'off' | 'one' | 'all'
  const [priceEditModal, setPriceEditModal] = useState(false);
  const [optimisticPrice, setOptimisticPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const { toast, toasts, removeToast } = useToast();
  const token = useMemo(() => localStorage.getItem('token') || null, []);
  const localUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || localStorage.getItem('demo_user') || 'null'); } catch { return null; }
  }, []);
  const isOwner = useMemo(() => {
    const uid = localUser?.id;
    return uid && song?.user_id && String(uid) === String(song.user_id);
  }, [localUser?.id, song?.user_id]);
  const [ownerPlayMode, setOwnerPlayMode] = useState('full'); // 'full' | 'preview'

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

  const handlePriceEdit = () => {
    if (!token) { toast.error('Please log in as the creator to change the price.'); return; }
    setPriceEditModal(true);
  };

  const handlePriceSave = async (newPrice) => {
    setPriceLoading(true);
    setOptimisticPrice(newPrice); // Show new price immediately
    
    try {
      const updated = await Song.update(song.id, { price: newPrice });
      if (updated) {
        setSong(updated);
        toast.success('Price updated successfully!');
        setPriceEditModal(false);
      } else {
        throw new Error('Failed to update price');
      }
    } catch (error) {
      toast.error('Failed to update price. Please try again.');
      console.error('Price update error:', error);
    } finally {
      setPriceLoading(false);
      setOptimisticPrice(null);
    }
  };

  if (loading) return <LoadingOverlay text="Loading" />;
  if (!song) return <div className="max-w-2xl mx-auto py-16 text-center text-gray-400">Song not found</div>;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card className="p-6 flex flex-col items-center gap-6">
        <img src={song.cover_image || 'https://via.placeholder.com/160?text=%F0%9F%8E%B5'} alt={song.title} className="w-40 h-40 rounded-lg object-cover mb-2" />
        <h1 className="text-2xl font-bold text-white mb-1">{song.title}</h1>
        <div className="text-gray-400 mb-2">{song.artist}</div>
        {/* Render the player immediately; pass loading while the audio URL is being resolved */}
        {isOwner && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Source:</span>
            <div className="inline-flex rounded-md overflow-hidden border border-slate-700">
              <button
                className={`px-2 py-1 text-xs ${ownerPlayMode === 'preview' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-gray-300'} disabled:opacity-50`}
                onClick={() => { setOwnerPlayMode('preview'); setAudioUrl(previewUrl || fullUrl || null); }}
                disabled={!previewUrl}
              >Preview</button>
              <button
                className={`px-2 py-1 text-xs ${ownerPlayMode === 'full' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-gray-300'} disabled:opacity-50`}
                onClick={() => { setOwnerPlayMode('full'); setAudioUrl(fullUrl || previewUrl || null); }}
                disabled={!fullUrl}
              >Full</button>
            </div>
          </div>
        )}
        <AudioPlayer
          src={isOwner ? (ownerPlayMode === 'full' ? (fullUrl || previewUrl) : (previewUrl || fullUrl)) : audioUrl}
          loading={audioFetching}
          title={song.title}
          showPreviewBadge={!purchased}
          hasPrev={false}
          hasNext={false}
          loopMode={loopMode}
          onLoopModeChange={setLoopMode}
          embedded
        />
  <div className="text-sm text-gray-300">Pay what you want • Min GH₵ {parseFloat((optimisticPrice ?? song?.price) || 0)?.toFixed(2)}</div>
        <div className="mt-2">
          <div className="flex items-center gap-3 justify-center">
            <div className="text-sm text-gray-400">Min price: GH₵ {parseFloat((optimisticPrice ?? song?.price)||0).toFixed(2)}</div>
            {isOwner && (
              <PriceDisplay 
                price={optimisticPrice ?? song?.price}
                optimisticPrice={optimisticPrice}
                canEdit={true}
                onEdit={handlePriceEdit}
                loading={priceLoading}
              />
            )}
          </div>
        </div>
    <div className="w-full text-center text-sm text-gray-400 mt-2">You can choose to pay more to support the creator. Minimum applies.</div>
        {!isOwner && (
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
        )}
        {song.description && <div className="text-gray-300 mt-2">{song.description}</div>}
      </Card>
      <PriceEditModal
        isOpen={priceEditModal}
        onClose={() => setPriceEditModal(false)}
        currentPrice={song?.price}
        onSave={handlePriceSave}
        loading={priceLoading}
        itemType="song"
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
