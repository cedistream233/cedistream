
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Song } from '@/entities/Song';
import { Card } from '@/components/ui/card';
import AudioPlayer from '@/components/media/AudioPlayer';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { setPostAuthIntent } from '@/utils';
import PriceEditModal, { PriceDisplay } from '@/components/ui/PriceEditModal';
import PayWhatYouWant from '@/components/ui/PayWhatYouWant';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import TopSupporters from '@/components/content/TopSupporters';

export default function SongDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoplayRequested = (searchParams.get('autoplay') || '').toString() === '1' || (searchParams.get('autoplay') || '').toString().toLowerCase() === 'true';
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
  // helper: decode user id from JWT if local user isn't present
  const getIdFromToken = (tok) => {
    try {
      const parts = String(tok || '').split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload?.id || payload?.sub || payload?.user_id || null;
    } catch (e) { return null; }
  };

  const isOwner = useMemo(() => {
    // Only consider the user the owner if there's a real auth token present.
    const tok = localStorage.getItem('token');
    if (!tok) return false;
    const uid = localUser?.id || getIdFromToken(tok);
    return uid && song?.user_id && String(uid) === String(song.user_id);
  }, [localUser?.id, song?.user_id]);
  const [ownerPlayMode, setOwnerPlayMode] = useState('full'); // 'full' | 'preview'
  const [salesSummary, setSalesSummary] = useState({ count: 0, gross_total: 0, creator_total: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await Song.get(id);
      setSong(data);
      // Seed preview URL from metadata immediately so UI buttons render enabled sooner
      if (data?.preview_url) setPreviewUrl(prev => prev || data.preview_url);
      // fetch sales summary if owner
      try {
        const u = JSON.parse(localStorage.getItem('user') || localStorage.getItem('demo_user') || 'null') || {};
        const ownerId = u?.id || getIdFromToken(localStorage.getItem('token'));
        if (ownerId && data?.user_id && String(ownerId) === String(data.user_id)) {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/uploads/sales/song/${data.id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' }});
          if (res.ok) setSalesSummary(await res.json());
          else setSalesSummary({ count: 0, gross_total: 0, creator_total: 0 });
        }
      } catch (e) { setSalesSummary({ count: 0, gross_total: 0, creator_total: 0 }); }
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
        if (Object.prototype.hasOwnProperty.call(song, 'preview_url')) {
          prev = song.preview_url || null; // explicit knowledge: may be null
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
      {/* Top Supporters Leaderboard */}
      <div className="mb-6">
        <TopSupporters itemType="song" itemId={song.id} />
      </div>

      <Card className="p-5 md:p-6 flex flex-col items-center gap-5 md:gap-6">
        <img src={song.cover_image || 'https://via.placeholder.com/160?text=%F0%9F%8E%B5'} alt={song.title} className="w-40 h-40 rounded-lg object-cover mb-2" />
        <h1 className="text-2xl font-bold text-white mb-0.5">{song.title}</h1>
        <div className="text-gray-400 mb-1">{song.artist}</div>
        {isOwner && (
          <div className="text-sm text-slate-300 mt-1">Sold {salesSummary.count} • You received GH₵ {Number(salesSummary.creator_total || 0).toFixed(2)}{salesSummary.count === 0 ? ' (no sales yet)' : ''}</div>
        )}
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
            autoPlay={!!(autoplayRequested && purchased)}
            showPreviewBadge={!purchased}
            previewCapSeconds={!purchased ? 30 : undefined}
            hasPrev={false}
            hasNext={false}
            loopMode={loopMode}
            onLoopModeChange={setLoopMode}
            embedded
          />
        )}
  {/* Pay What You Want panel for supporters — hide if this user already purchased and is viewing */}
        {!isOwner && (
          <div className="w-full mt-4">
            <PayWhatYouWant
              minPrice={Number(song.price || 1)}
              buttonLabel={purchased ? 'Support again' : 'Add to Cart'}
              onAdd={async () => {
                const token = localStorage.getItem('token');
                const min = Number(song.price || 1);
                // For purchase-repeat, we always add a new cart entry so users can support multiple times.
                const cartItem = { item_type: 'song', item_id: song.id, title: song.title, price: min, min_price: min, image: song.cover_image, _support_nonce: Date.now() };
                if (!token) {
                  setPostAuthIntent({
                    action: 'add-to-cart',
                    item: cartItem,
                    redirect: '/cart'
                  });
                  window.location.href = '/signup';
                  return;
                }
                try {
                  const uRaw = localStorage.getItem('user');
                  const u = uRaw ? JSON.parse(uRaw) : {};
                  const cart = Array.isArray(u.cart) ? u.cart : [];
                  // Always allow adding repeat support entries; don't dedupe by existing purchases.
                  const nextCart = [...cart, cartItem];
                  try { localStorage.setItem('user', JSON.stringify({ ...u, cart: nextCart })); } catch {}
                  try { localStorage.setItem('demo_user', JSON.stringify({ ...u, cart: nextCart })); } catch {}
                } catch {}
                window.location.href = '/cart';
              }}
            />
          </div>
        )}
  {song.description && <div className="text-gray-300 mt-2">{song.description}</div>}
  {/* Price display/edit - only allow editing for the owner */}
  <div className="w-full mt-4">
    <PriceDisplay
      price={song?.price}
      onEdit={handlePriceEdit}
      canEdit={isOwner}
      optimisticPrice={optimisticPrice}
      loading={priceLoading}
    />
  </div>
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
