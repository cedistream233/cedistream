import React, { useState, useEffect, useCallback } from "react";
import { Video } from "@/entities/Video";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Play, Clock, Calendar } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { createPageUrl, setPostAuthIntent } from "@/utils";
import { format } from "date-fns";
import formatDuration from '@/lib/formatDuration';
import ChooseAmountModal from '@/components/ui/ChooseAmountModal';
import PriceEditModal, { PriceDisplay } from '@/components/ui/PriceEditModal';
import VideoPlayer from '@/components/media/VideoPlayer';
import TopSupporters from '@/components/content/TopSupporters';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { useAuth } from '@/contexts/AuthContext';
import LikeButton from '@/components/content/LikeButton';
import CommentsSection from '@/components/content/CommentsSection';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export default function VideoDetails() {
  const navigate = useNavigate();
  const { id: videoId } = useParams();
  const { updateMyUserData } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  
  const [video, setVideo] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [hqUrl, setHqUrl] = useState(null);
  const [mediaFetching, setMediaFetching] = useState(false);
  const handlePlayerReady = useCallback(() => setMediaFetching(false), []);
  // Prevent a very short "skeleton flash" by delaying the skeleton show
  // for fast responses. This avoids the initial placeholder appearing for
  // a split second before the real page renders.
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [amountModal, setAmountModal] = useState({ visible: false, min: 0 });
  const [priceEditModal, setPriceEditModal] = useState(false);
  const [optimisticPrice, setOptimisticPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [salesSummary, setSalesSummary] = useState({ count: 0, gross_total: 0, creator_total: 0 });
  const localUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || localStorage.getItem('demo_user') || 'null'); } catch { return null; }
  }, []);

  // Derived flags for rendering
  // Don't show the "no preview" state while we're still fetching the media URL.
  const noPreviewAvailable = !canAccess && mediaUrl === null && !mediaFetching;
  const getIdFromToken = (tok) => {
    try {
      const parts = String(tok || '').split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload?.id || payload?.sub || payload?.user_id || null;
    } catch (e) { return null; }
  };

  const isOwner = React.useMemo(() => {
    // Require an auth token before considering the user the owner to avoid showing owner-only UI
    const tok = localStorage.getItem('token');
    if (!tok) return false;
    const uid = user?.id || localUser?.id || getIdFromToken(tok);
    return uid && video?.user_id && String(uid) === String(video.user_id);
  }, [user?.id, localUser?.id, video?.user_id]);

  useEffect(() => {
    if (videoId) {
      loadVideo();
      loadUser();
    }
  }, [videoId]);

  const loadUser = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {}
  };

  const loadVideo = async () => {
    setIsLoading(true);
    try {
      // Try list first (fast path)
      let foundVideo = null;
      try {
        const videos = await Video.list();
        foundVideo = videos.find(v => v.id === videoId) || null;
      } catch {
        foundVideo = null;
      }

      // Fallback to fetching a single video if not in list
      if (!foundVideo) {
        try { foundVideo = await Video.get(videoId); } catch { foundVideo = null; }
      }

      setVideo(foundVideo);
      // indicate we're about to fetch the media URL / preview so the UI
      // can show a loading overlay immediately and prevent premature clicks
      if (foundVideo) {
        setMediaFetching(true);
      }

      // Parallelize sales fetch for owners (non-blocking)
      if (foundVideo) {
        const ownerId = user?.id || localUser?.id || getIdFromToken(localStorage.getItem('token'));
        if (ownerId && String(ownerId) === String(foundVideo.user_id)) {
          const token = localStorage.getItem('token');
          fetch(`/api/uploads/sales/video/${foundVideo.id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' }})
            .then(res => res.ok ? res.json() : { count: 0, gross_total: 0, creator_total: 0 })
            .then(setSalesSummary)
            .catch(() => setSalesSummary({ count: 0, gross_total: 0, creator_total: 0 }));
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!video) return;

    // indicate we're starting the media lookup immediately and clear any
    // previously cached media URL so an old preview doesn't linger.
    setMediaFetching(true);
        setMediaUrl(null);

        // First, check if a preview was pre-fetched and stored
        try {
          const stored = sessionStorage.getItem(`preview:video:${video.id}`);
          if (stored) {
            if (!cancelled) {
              setMediaUrl(stored);
              setCanAccess(false);
              sessionStorage.removeItem(`preview:video:${video.id}`);
            }
            return;
          }
        } catch {}

        const token = localStorage.getItem('token');
        // If authorized, attempt to get full signed URL(s)
        if (token) {
          try {
            const res = await fetch(`/api/media/video/${video.id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const d = await res.json();
              if (cancelled) return;
              if (d) {
                // backend returns { hq, sd, hq_signed, sd_signed }
                const isBackblazeHost = (u) => typeof u === 'string' && u.includes('backblazeb2.com');
                let chosen = null;
                if (d.sd_signed && !isBackblazeHost(d.sd_signed)) chosen = d.sd_signed;
                else if (d.sd) chosen = d.sd; // proxy
                else if (d.hq_signed && !isBackblazeHost(d.hq_signed)) chosen = d.hq_signed;
                else if (d.hq) chosen = d.hq;
                else chosen = d.url || null;

                // Only treat this as full-access if the viewer is the owner OR
                // the purchases API confirms a completed purchase for this video.
                let allow = false;
                if (isOwner) {
                  allow = true;
                } else {
                  try {
                    const pRes = await fetch(`/api/purchases?item_type=video&me=true`, { headers: { Authorization: `Bearer ${token}` } });
                    if (pRes.ok) {
                      const rows = await pRes.json();
                      if (Array.isArray(rows) && rows.some(r => (r.payment_status === 'completed' || r.payment_status === 'success') && String(r.item_type) === 'video' && String(r.item_id) === String(video.id))) {
                        allow = true;
                      }
                    }
                  } catch (e) {
                    // ignore purchase check errors — default to deny to avoid false positives
                    allow = false;
                  }
                }

                if (allow) {
                  if (!cancelled) {
                    setCanAccess(true);
                    setHqUrl(d?.hq || d?.hq_signed || null);
                    setMediaUrl(chosen);
                  }
                  return;
                }
              }
              return;
            }
          } catch (e) {
            // ignore and fall back to preview
          }
        }

        // fallback to preview: prefer backend preview endpoint (which may return
        // a proxied URL with correct CORS headers) over the raw metadata
        // preview_url which can be a direct Backblaze URL lacking CORS.
        try {
          const { Video: VideoEntity } = await import('@/entities/Video');
          const prevUrl = await VideoEntity.getPreviewUrl(video.id);
          if (prevUrl) {
            if (!cancelled) { setMediaUrl(prevUrl); setCanAccess(false); }
            return;
          }
        } catch (e) {
          // ignore and fallback to metadata below
        }

        // If backend preview lookup failed, fall back to raw metadata if it exists
        if (Object.prototype.hasOwnProperty.call(video, 'preview_url')) {
          if (!cancelled) { setMediaUrl(video.preview_url || null); setCanAccess(false); }
          return;
        }

        if (!cancelled) { setMediaUrl(null); setCanAccess(false); }
      } catch (e) {
        // swallow errors to avoid breaking render
      } finally {
        if (!cancelled) setMediaFetching(false);
      }
    })();

    return () => { cancelled = true; };
  }, [video?.id]);

  // Delay showing the skeleton briefly so we don't flash it on fast loads.
  useEffect(() => {
    let id = null;
    if (isLoading) {
      // show skeleton only after a short delay
      id = setTimeout(() => setShowSkeleton(true), 160);
    } else {
      setShowSkeleton(false);
    }
    return () => { if (id) clearTimeout(id); };
  }, [isLoading]);

  

  // fetch sales summary for owners
  useEffect(() => {
    (async () => {
      try {
        if (!video) return;
        const ownerId = user?.id || localUser?.id || getIdFromToken(localStorage.getItem('token'));
        if (!ownerId || String(ownerId) !== String(video.user_id)) return;
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/uploads/sales/video/${video.id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' }});
        if (res.ok) setSalesSummary(await res.json());
        else setSalesSummary({ count: 0, gross_total: 0, creator_total: 0 });
      } catch (e) { setSalesSummary({ count: 0, gross_total: 0, creator_total: 0 }); }
    })();
  }, [video?.id, isOwner]);

  const handleAddToCart = async () => {
    const token = localStorage.getItem('token');
    const min = Number(video.price || 0);
    if (!token) {
      setPostAuthIntent({
        action: 'add-to-cart',
        item: {
          item_type: 'video',
          item_id: video.id,
          title: video.title,
          price: min,
          min_price: min,
          image: video.thumbnail
        },
        redirect: '/cart'
      });
      window.location.href = '/signup';
      return;
    }

    // Authenticated: update via context so header/cart badge updates instantly, then navigate
    try {
      const uRaw = localStorage.getItem('user');
      const u = uRaw ? JSON.parse(uRaw) : {};
      const cart = Array.isArray(u.cart) ? u.cart : [];
      // Always append a new cart entry for repeat support with a nonce
      const nextCart = [...cart, { item_type: 'video', item_id: video.id, title: video.title, price: min, min_price: min, image: video.thumbnail, _support_nonce: Date.now() }];
      await updateMyUserData({ cart: nextCart });
    } catch {}
    navigate(createPageUrl('Cart'));
  };

  const onModalCancel = () => setAmountModal({ visible: false, min: 0 });
  const onModalConfirm = async (chosenAmount) => {
    const cartItem = {
      item_type: "video",
      item_id: video.id,
      title: video.title,
      price: chosenAmount,
      min_price: Number(video.price || 0),
      image: video.thumbnail
    };
    const currentCart = (user && Array.isArray(user.cart)) ? user.cart : (() => {
      try { const ur = localStorage.getItem('user'); const uu = ur ? JSON.parse(ur) : null; return Array.isArray(uu?.cart) ? uu.cart : []; } catch { return []; }
    })();
    const itemExists = currentCart.some(i => i.item_id === video.id);
    if (!itemExists) {
      await updateMyUserData({ cart: [...currentCart, cartItem] });
      navigate(createPageUrl("Cart"));
    }
    onModalCancel();
  };

  const handlePriceEdit = () => {
    const token = localStorage.getItem('token');
    if (!token) return; // require auth to edit
    setPriceEditModal(true);
  };

  const handlePriceSave = async (newPrice) => {
    setPriceLoading(true);
    setOptimisticPrice(newPrice);
    try {
      const updated = await Video.update(video.id, { price: newPrice });
      if (updated) {
        setVideo(updated);
        toast.success('Price updated successfully!');
        setPriceEditModal(false);
      } else {
        throw new Error('Failed to update price');
      }
    } catch (error) {
      console.error('Video price update error:', error);
      toast.error('Failed to update price. Please try again.');
    } finally {
      setPriceLoading(false);
      setOptimisticPrice(null);
    }
  };

  // Only show the skeleton when metadata is loading and we haven't started
  // the media lookup. If the media lookup is in progress we render the
  // normal page (thumbnail + spinner overlay) so users see context while
  // the preview resolves.
    // Only show the skeleton when we're still loading metadata and we don't
    // yet have video metadata. If `video` is already present, render the
    // page so the thumbnail + spinner overlay can be shown while media
    // resolution continues.
    if (isLoading && !video) {
      // Use the shared full-screen loading overlay used across the app so
      // this page matches the library / other pages.
      return <LoadingOverlay text="Loading video" />;
    }

  if (!video) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-400">Video not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link removed per request */}

      {/* Top Supporters Leaderboard */}
      <div className="mb-8">
        <TopSupporters itemType="video" itemId={video.id} />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          {(!isOwner && noPreviewAvailable) ? (
            <div className="w-full rounded-lg overflow-hidden bg-black/60 p-6 flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm text-gray-300">No preview available</div>
                <div className="text-xs text-gray-500 mt-1">This creator hasn't uploaded a preview for this video.</div>
              </div>
            </div>
          ) : (
            <div className="w-full rounded-lg overflow-hidden bg-black/60">
              {mediaUrl ? (
                <VideoPlayer src={mediaUrl} poster={video.thumbnail} showPreviewBadge={!canAccess} onReady={handlePlayerReady} suppressLoadingUI={true} />
              ) : (
                video.thumbnail ? (
                  <div className="relative group">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full rounded-2xl shadow-2xl"
                    />
                    {mediaFetching && (
                      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto rounded-2xl">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 border-4 border-t-transparent border-white/90 rounded-full animate-spin" />
                          <div className="text-sm text-white/90">Loading video…</div>
                        </div>
                      </div>
                    )}
                    {/* Only show Locked badge if NOT owner and not accessible */}
                    {(!isOwner && !canAccess) && (
                      <div className="absolute top-3 left-3 text-[11px] uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded">Locked</div>
                    )}
                    {/* overlay removed to avoid bright white play button before video loads */}
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl flex items-center justify-center">
                    <Play className="w-32 h-32 text-purple-300" />
                  </div>
                )
              )}
            </div>
          )}

        </div>
        <div className="flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{video.title}</h1>
            <p className="text-2xl text-pink-400 mb-6">{video.creator}</p>
            {video.description && (
              <p className="text-gray-400 text-lg">{video.description}</p>
            )}
            {/* Desktop sales summary for creators (shows near title for visibility) */}
            {isOwner && (
              <div className="hidden md:block text-sm text-slate-300 mt-3">
                Sold {salesSummary.count} • You received GH₵ {Number(salesSummary.creator_total || 0).toFixed(2)}{salesSummary.count === 0 ? ' (no sales yet)' : ''}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 mb-8 text-gray-400">
            {video.category && (
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                <span>{video.category}</span>
              </div>
            )}
            {video.duration && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{formatDuration(video.duration)}</span>
              </div>
            )}
            {video.release_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{format(new Date(video.release_date), "MMM yyyy")}</span>
              </div>
            )}
          </div>

          <div className="bg-slate-900/50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Minimum price:</span>
              <PriceDisplay price={video?.price} onEdit={handlePriceEdit} canEdit={isOwner} optimisticPrice={optimisticPrice} loading={priceLoading} />
            </div>
            {/* Mobile-only: keep original placement inside price card */}
            {isOwner && (
              <div className="md:hidden text-sm text-slate-300 mt-2">Sold {salesSummary.count} • You received GH₵ {Number(salesSummary.creator_total || 0).toFixed(2)}{salesSummary.count === 0 ? ' (no sales yet)' : ''}</div>
            )}
          </div>

          {/* If the viewer is the owner, show a Play button / owner CTA. Otherwise show Add to Cart. */}
          {isOwner ? (
            <Button
              onClick={() => {
                // Try to auto-play if possible
                const player = document.querySelector('video');
                if (player) player.play().catch(()=>{});
              }}
              size="lg"
              className="w-full md:w-auto px-6 md:px-8 py-4 md:py-4 bg-green-600 hover:bg-green-700 text-lg flex items-center"
            >
              <Play className="w-5 h-5 mr-2" />
              <span>Play</span>
            </Button>
          ) : (
            <Button
              onClick={handleAddToCart}
              size="lg"
              className="w-full md:w-auto px-6 md:px-8 py-4 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg flex items-center"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              <span>{canAccess ? 'Support again' : 'Add to Cart'}</span>
            </Button>
          )}
          
          {/* Like Button */}
          <div className="mt-4">
            <LikeButton contentType="video" contentId={video.id} />
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="mt-8">
        <CommentsSection contentType="video" contentId={video.id} canModerate={isOwner} />
      </div>

      <ChooseAmountModal visible={amountModal.visible} min={amountModal.min} onCancel={onModalCancel} onConfirm={onModalConfirm} />
      <PriceEditModal
        isOpen={priceEditModal}
        onClose={() => setPriceEditModal(false)}
        currentPrice={video?.price}
        onSave={handlePriceSave}
        loading={priceLoading}
        itemType="video"
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}