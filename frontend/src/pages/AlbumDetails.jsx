import React, { useState, useEffect, useMemo } from "react";
import { Album } from "@/entities/Album";
import { User } from "@/entities/User";
import { Song } from "@/entities/Song";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Music, Clock, Calendar } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { createPageUrl, setPostAuthIntent } from "@/utils";
import { format } from "date-fns";
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ChooseAmountModal from '@/components/ui/ChooseAmountModal';
import AudioPlayer from '@/components/media/AudioPlayer';
import { PriceEditModal, PriceDisplay } from '@/components/ui/PriceEditModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export default function AlbumDetails() {
  const navigate = useNavigate();
  const { id: albumId } = useParams();
  
  const [album, setAlbum] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchased, setPurchased] = useState(false);
  // Keep separate maps for preview and full audio URLs
  const [trackPreviewUrls, setTrackPreviewUrls] = useState({});
  const [trackFullUrls, setTrackFullUrls] = useState({});
  const [audioFetching, setAudioFetching] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loopMode, setLoopMode] = useState('off'); // 'off' | 'one' | 'all'
  const [amountModal, setAmountModal] = useState({ visible: false, min: 0 });
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(false);
  const [priceEditModal, setPriceEditModal] = useState(false);
  const [optimisticPrice, setOptimisticPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const { toasts, toast, removeToast } = useToast();
  const token = useMemo(() => localStorage.getItem('token') || null, []);

  // Determine ownership robustly from multiple sources
  const localUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || localStorage.getItem('demo_user') || 'null');
    } catch { return null; }
  }, []);
  const isOwner = useMemo(() => {
    const uid = user?.id || localUser?.id;
    return uid && album?.user_id && String(uid) === String(album.user_id);
  }, [user?.id, localUser?.id, album?.user_id]);

  // For creators: allow choosing between preview and full when preview exists
  const [ownerPlayMode, setOwnerPlayMode] = useState('full'); // 'full' | 'preview'

  // helpers (must be declared before any early returns to keep hook order stable)
  const albumHasAnyPreview = useMemo(() => {
    if (!album?.songs?.length) return false;
    // if we have computed preview URLs map, check it; fallback to false
    return album.songs.some(s => !!trackPreviewUrls[s.id]);
  }, [album?.songs, trackPreviewUrls]);

  useEffect(() => {
    if (albumId) {
      loadAlbum();
      loadUser();
    }
  }, [albumId]);

  const loadUser = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {}
  };

  // clear the one-time autoPlay trigger after a short delay so it's only applied once
  useEffect(() => {
    if (!autoPlayTrigger) return;
    const t = setTimeout(() => setAutoPlayTrigger(false), 250);
    return () => clearTimeout(t);
  }, [autoPlayTrigger]);

  const loadAlbum = async () => {
    if (!albumId) return;
    setIsLoading(true);
    try {
      const foundAlbum = await Album.get(albumId);
      setAlbum(foundAlbum);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!album || !user) return;
      try {
        // naive ownership check: look for completed album purchase
        const token = localStorage.getItem('token');
        if (!token) { setPurchased(false); return; }
        // Optional: You might have a dedicated endpoint; keeping simple here
  const res = await fetch(`/api/purchases?item_type=album&me=true`, { headers: { Authorization: `Bearer ${token}` }});
        if (res.ok) {
          const rows = await res.json();
          setPurchased(rows?.some(r => r.item_id === album.id && r.payment_status === 'completed'));
        } else { setPurchased(false); }
      } catch { setPurchased(false); }
    })();
  }, [album?.id, user?.id]);

  useEffect(() => {
    (async () => {
      if (!album?.songs?.length) return;
      setAudioFetching(true);
      const previews = {};
      const fulls = {};
      for (const s of album.songs) {
        // Fetch preview for all (if exists)
        try {
          const p = await Song.getPreviewUrl(s.id);
          if (p) previews[s.id] = p;
        } catch {}

        // Fetch full for owner or if purchased
        if (isOwner || purchased) {
          try {
            const f = await Song.getSignedUrl(s.id, token);
            if (f) fulls[s.id] = f;
          } catch {}
        }
      }
      setTrackPreviewUrls(previews);
      setTrackFullUrls(fulls);
      setAudioFetching(false);
    })();
  }, [album?.songs, purchased, isOwner, token]);

  const onPrev = () => {
    if (!album?.songs?.length) return;
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAutoPlayTrigger(true);
    }
    else if (loopMode === 'all') {
      setCurrentIndex(album.songs.length - 1);
      setAutoPlayTrigger(true);
    }
  };
  const onNext = () => {
    if (!album?.songs?.length) return;
    if (currentIndex < album.songs.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAutoPlayTrigger(true);
    }
    else if (loopMode === 'all') {
      setCurrentIndex(0);
      setAutoPlayTrigger(true);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      const min = Number(album.price || 0);
      setPostAuthIntent({
        action: 'add-to-cart',
        item: {
          item_type: 'album',
          item_id: album.id,
          title: album.title,
          price: min,
          min_price: min,
          image: album.cover_image
        },
        redirect: '/cart'
      });
      window.location.href = '/signup';
      return;
    }
    const minPrice = Number(album.price || 0);
    setAmountModal({ visible: true, min: minPrice });
  };

  const onModalCancel = () => setAmountModal({ visible: false, min: 0 });
  const onModalConfirm = async (chosenAmount) => {
    const cartItem = {
      item_type: "album",
      item_id: album.id,
      title: album.title,
      price: chosenAmount,
      min_price: Number(album.price || 0),
      image: album.cover_image
    };
    const currentCart = user.cart || [];
    const itemExists = currentCart.some(i => i.item_id === album.id);
    if (!itemExists) {
      await User.updateMyUserData({ cart: [...currentCart, cartItem] });
      navigate(createPageUrl("Cart"));
    }
    onModalCancel();
  };

  const handlePriceEdit = () => {
    if (!token) {
      toast.error('Please log in as the creator to change the price.');
      return;
    }
    setPriceEditModal(true);
  };

  const handlePriceSave = async (newPrice) => {
    setPriceLoading(true);
    setOptimisticPrice(newPrice); // Show new price immediately
    
    try {
      const updated = await Album.update(album.id, { price: newPrice });
      if (updated) {
        setAlbum(updated);
        toast.success('Price updated successfully!');
        setPriceEditModal(false);
      } else {
        throw new Error('Failed to update price');
      }
    } catch (error) {
      toast.error('Failed to update price. Make sure you are logged in and own this album.');
      console.error('Price update error:', error);
    } finally {
      setPriceLoading(false);
      setOptimisticPrice(null);
    }
  };

  if (isLoading) {
    return <LoadingOverlay text="Loading album" />;
  }

  if (!album) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-400">Album not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button intentionally removed per UX preference */}

      <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-12">
        <div>
          {album.cover_image ? (
            <img
              src={album.cover_image}
              alt={album.title}
              className="w-full rounded-2xl shadow-2xl"
            />
          ) : (
            <div className="w-full aspect-square bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl flex items-center justify-center">
              <Music className="w-32 h-32 text-purple-300" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-2 md:mb-6">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-1 md:mb-4 ">{album.title}</h1>
            <p className="text-2xl text-purple-400 mb-2">{album.artist}</p>
            {album.description && (
              <p className="text-gray-400 text-lg">{album.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3 md:mb-4 text-gray-400">
            {album.genre && (
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5" />
                <span>{album.genre}</span>
              </div>
            )}
            {album.release_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{format(new Date(album.release_date), "MMM yyyy")}</span>
              </div>
            )}
            {album.songs?.length > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{album.songs.length} tracks</span>
              </div>
            )}
          </div>

          {/* Play/Shuffle removed per request */}

          <div className="mb-4 md:mb-6">
            <div className="bg-slate-900/50 rounded-xl p-4 md:p-6 mb-4 md:mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Minimum price:</span>
                <PriceDisplay 
                  price={optimisticPrice ?? album?.price}
                  optimisticPrice={optimisticPrice}
                  canEdit={!!isOwner}
                  onEdit={handlePriceEdit}
                  loading={priceLoading}
                />
              </div>
            </div>
          </div>

          {/* price editor above will update album state (removed empty decorative bar) */}

          {!isOwner && (
            <Button
              onClick={handleAddToCart}
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Add to Cart
            </Button>
          )}
        </div>
      </div>

      {album.songs?.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-3 md:mb-6">Now Playing</h2>
          {isOwner && (
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className="text-gray-400">Source:</span>
              <div className="inline-flex rounded-md overflow-hidden border border-slate-700">
                <button
                  className={`px-3 py-1 ${ownerPlayMode === 'preview' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-gray-300'} disabled:opacity-50`}
                  onClick={() => setOwnerPlayMode('preview')}
                  disabled={!trackPreviewUrls[album.songs[currentIndex]?.id]}
                >
                  Preview
                </button>
                <button
                  className={`px-3 py-1 ${ownerPlayMode === 'full' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-gray-300'} disabled:opacity-50`}
                  onClick={() => setOwnerPlayMode('full')}
                  disabled={!trackFullUrls[album.songs[currentIndex]?.id]}
                >
                  Full
                </button>
              </div>
            </div>
          )}
          <div className="mb-4 md:mb-6">
            {/* Always render the player immediately (shows loading while URLs fetch). */}
            <AudioPlayer
              src={( () => {
                const currentSong = album.songs[currentIndex];
                const sid = currentSong?.id;
                if (isOwner) {
                  return ownerPlayMode === 'full'
                    ? (trackFullUrls[sid] || trackPreviewUrls[sid] || null)
                    : (trackPreviewUrls[sid] || trackFullUrls[sid] || null);
                }
                if (purchased) return trackFullUrls[sid] || trackPreviewUrls[sid] || null;
                return albumHasAnyPreview ? (trackPreviewUrls[sid] || null) : null;
              })() }
              autoPlay={autoPlayTrigger}
              loading={audioFetching}
              title={album.songs[currentIndex]?.title || 'Track'}
              artwork={album.cover_image}
              showPreviewBadge={!purchased && !isOwner}
              onEnded={() => { if (loopMode === 'all') onNext(); }}
              onPrev={onPrev}
              onNext={onNext}
              hasPrev={album.songs.length > 1}
              hasNext={album.songs.length > 1}
              loopMode={loopMode}
              onLoopModeChange={setLoopMode}
            />
          </div>

          <h3 className="text-xl font-semibold text-white mb-3">Tracklist</h3>
          <Card className="bg-slate-900/50 border-purple-900/20">
            <div className="divide-y divide-purple-900/20">
              {album.songs.map((song, index) => (
                <button
                  key={song.id || index}
                  onClick={() => { setCurrentIndex(index); setAutoPlayTrigger(true); }}
                  className={`w-full text-left p-4 hover:bg-purple-900/10 transition-colors ${index===currentIndex?'bg-purple-900/10':''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 font-medium w-8">{index + 1}</span>
                      <div>
                        <p className="text-white font-medium">{song.title}</p>
                        {song.duration && (
                          <p className="text-sm text-gray-400">{song.duration}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {(() => {
                        const hasFull = !!trackFullUrls[song.id];
                        const hasPreview = !!trackPreviewUrls[song.id];
                        if (audioFetching && !hasFull && !hasPreview) return 'Loading...';
                        if (isOwner) {
                          return (hasFull || hasPreview) ? (index===currentIndex ? 'Playing' : 'Tap to play') : 'No audio';
                        }
                        if (purchased) {
                          return hasFull ? (index===currentIndex ? 'Playing' : 'Tap to play') : 'Loading...';
                        }
                        return hasPreview ? (index===currentIndex ? 'Playing' : 'Tap to play') : 'Locked';
                      })()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
      {/* Global modals/toasts */}
      <PriceEditModal
      isOpen={priceEditModal}
      onClose={() => setPriceEditModal(false)}
      currentPrice={album?.price}
      onSave={handlePriceSave}
      loading={priceLoading}
      itemType="album"
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}