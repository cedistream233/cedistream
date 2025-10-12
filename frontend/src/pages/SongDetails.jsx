import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Song } from '@/entities/Song';
import { Card } from '@/components/ui/card';
import AudioPlayer from '@/components/media/AudioPlayer';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { setPostAuthIntent } from '@/utils';
import PriceEditModal, { PriceDisplay } from '@/components/ui/PriceEditModal';
import PayWhatYouWant from '@/components/ui/PayWhatYouWant';
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
      // Seed preview URL from metadata immediately so UI buttons render enabled sooner
      if (data?.preview_url) setPreviewUrl(prev => prev || data.preview_url);
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
        // Only treat signed URL as full-access; do not rely on raw audio_url
        if (token) {
          try { full = await Song.getSignedUrl(song.id, token); } catch (e) { full = null; }
        }

        // attempt to use any prefetched preview stored in sessionStorage
        let pref = null;
        try { pref = sessionStorage.getItem(`preview:${song.id}`); } catch {}
        if (pref) {
          // prefetched previews indicate the user previously requested a preview; treat as preview
          setPurchased(false);
          setPreviewUrl(pref);
          setAudioUrl(pref);
          try { sessionStorage.removeItem(`preview:${song.id}`); } catch {}
          // still try to populate full in background
          if (!full && token) {
            try { const f = await Song.getSignedUrl(song.id, token); if (f) setFullUrl(f); } catch {}
          }
          return;
        }

        // no prefetched preview; prefer metadata.preview_url then fall back to network
        let prev = null;
        if (song.preview_url) {
          prev = song.preview_url;
        } else {
          try { prev = await Song.getPreviewUrl(song.id); } catch (e) { prev = null; }
        }

  setPreviewUrl(prev || null);
  setFullUrl(full || null);

        if (full) {
          setPurchased(true);
          setAudioUrl(full);
        } else if (prev) {
          setPurchased(false);
          setAudioUrl(prev);
        } else {
          setAudioUrl(null);
        }
      } finally { setAudioFetching(false); }
    })();
  }, [song?.id]);

  const noPreviewAvailable = !audioFetching && !previewUrl && !fullUrl;

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
      <Card className="p-5 md:p-6 flex flex-col items-center gap-5 md:gap-6">
        <img src={song.cover_image || 'https://via.placeholder.com/160?text=%F0%9F%8E%B5'} alt={song.title} className="w-40 h-40 rounded-lg object-cover mb-2" />
        <h1 className="text-2xl font-bold text-white mb-0.5">{song.title}</h1>
        <div className="text-gray-400 mb-1">{song.artist}</div>
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
        {/* Render preview player or a clear 'No preview' placeholder for visitors/supporters */}
        {(!isOwner && noPreviewAvailable) ? (
          <div className="w-full mt-4 flex justify-center">
            <div className="rounded-lg border border-purple-900/20 bg-slate-900/40 p-6 text-center w-full">
              <div className="text-sm text-gray-300">No preview available</div>
              <div className="text-xs text-gray-500 mt-1">This creator hasn't uploaded a preview for this content.</div>
            </div>
          </div>
        ) : (
          <AudioPlayer
            src={isOwner
              ? (ownerPlayMode === 'full' ? (fullUrl || previewUrl) : (previewUrl || fullUrl))
              : audioUrl}
            loading={audioFetching}
            title={song.title}
            showPreviewBadge={!purchased}
            hasPrev={false}
            hasNext={false}
            loopMode={loopMode}
            onLoopModeChange={setLoopMode}
            embedded
          />
        )}
        {/* Pay What You Want panel for supporters */}
        {!isOwner && (
          <div className="w-full mt-4">
            <PayWhatYouWant
              minPrice={Number(song.price || 1)}
              onAdd={async () => {
                const token = localStorage.getItem('token');
                const min = Number(song.price || 1);
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
                  const u = JSON.parse(localStorage.getItem('user') || 'null') || {};
                  const cart = Array.isArray(u.cart) ? u.cart : [];
                  const exists = cart.some(i => i.item_id === song.id && i.item_type === 'song');
                  if (!exists) {
                    const next = { ...u, cart: [...cart, { item_type: 'song', item_id: song.id, title: song.title, price: min, min_price: min, image: song.cover_image }] };
                    try { localStorage.setItem('user', JSON.stringify(next)); } catch {}
                    try { localStorage.setItem('demo_user', JSON.stringify(next)); } catch {}
                  }
                } catch {}
                window.location.href = '/cart';
              }}
            />
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
