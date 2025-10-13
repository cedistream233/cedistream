import React, { useState, useEffect } from "react";
import { Video } from "@/entities/Video";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, Play, Clock, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl, setPostAuthIntent } from "@/utils";
import { format } from "date-fns";
import ChooseAmountModal from '@/components/ui/ChooseAmountModal';
import VideoPlayer from '@/components/media/VideoPlayer';
import TopSupporters from '@/components/content/TopSupporters';
import { useAuth } from '@/contexts/AuthContext';

export default function VideoDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get("id");
  const { updateMyUserData } = useAuth();
  
  const [video, setVideo] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [amountModal, setAmountModal] = useState({ visible: false, min: 0 });
  const [salesSummary, setSalesSummary] = useState({ count: 0, gross_total: 0, creator_total: 0 });
  const localUser = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || localStorage.getItem('demo_user') || 'null'); } catch { return null; }
  }, []);
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
    const videos = await Video.list();
    const foundVideo = videos.find(v => v.id === videoId);
    setVideo(foundVideo);
    setIsLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!video) return;

      // First, check if a preview was pre-fetched and stored
      try {
        const stored = sessionStorage.getItem(`preview:video:${video.id}`);
        if (stored) { setMediaUrl(stored); setCanAccess(false); sessionStorage.removeItem(`preview:video:${video.id}`); }
      } catch {}

      const token = localStorage.getItem('token');
      // If authorized, attempt to get full signed URL
      if (token) {
        const res = await fetch(`/api/media/video/${video.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json(); setCanAccess(true); setMediaUrl(d.url); return;
        }
      }

      // fallback to preview; prefer metadata.preview_url
      if (video.preview_url) {
        setMediaUrl(video.preview_url); setCanAccess(false); return;
      }
      const prevRes = await fetch(`/api/media/video/${video.id}/preview`);
      if (prevRes.ok) {
        const d = await prevRes.json(); setMediaUrl(d.url); setCanAccess(false);
      } else {
        setMediaUrl(null); setCanAccess(false);
      }
    })();
  }, [video?.id]);

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
      const exists = cart.some(i => i.item_id === video.id && i.item_type === 'video');
      if (!exists) {
        const nextCart = [...cart, { item_type: 'video', item_id: video.id, title: video.title, price: min, min_price: min, image: video.thumbnail }];
        await updateMyUserData({ cart: nextCart });
      }
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

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-800 rounded w-32 mb-8"></div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-video bg-slate-800 rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-12 bg-slate-800 rounded"></div>
              <div className="h-6 bg-slate-800 rounded w-3/4"></div>
              <div className="h-32 bg-slate-800 rounded"></div>
            </div>
          </div>
        </div>
        {(!canAccess && mediaUrl === null) && (
          <div className="mt-4">
            <div className="rounded-lg border border-purple-900/20 bg-slate-900/40 p-3 text-center">
              <div className="text-sm text-gray-300">No preview available</div>
              <div className="text-xs text-gray-500 mt-1">This creator hasn't uploaded a preview for this video.</div>
            </div>
          </div>
        )}
      </div>
    );
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
      <Button
        variant="ghost"
        onClick={() => navigate(createPageUrl("Videos"))}
        className="mb-8 text-purple-400 hover:text-purple-300"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Videos
      </Button>

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
                <VideoPlayer src={mediaUrl} poster={video.thumbnail} showPreviewBadge={!canAccess} />
              ) : (
                video.thumbnail ? (
                  <div className="relative group">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full rounded-2xl shadow-2xl"
                    />
                    {!canAccess && (
                      <div className="absolute top-3 left-3 text-[11px] uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded">Locked</div>
                    )}
                    <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center">
                        <Play className="w-10 h-10 text-purple-900 ml-1" />
                      </div>
                    </div>
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
                <span>{video.duration}</span>
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
              <span className="text-3xl font-bold text-yellow-400">From GH₵ {video.price?.toFixed(2)}</span>
            </div>
            {isOwner && (
              <div className="text-sm text-slate-300 mt-2">Sold {salesSummary.count} • You received GH₵ {Number(salesSummary.creator_total || 0).toFixed(2)}{salesSummary.count === 0 ? ' (no sales yet)' : ''}</div>
            )}
          </div>

          {!canAccess && (
            <Button
              onClick={handleAddToCart}
              size="lg"
              className="w-full md:w-auto px-6 md:px-8 py-4 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg flex items-center"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              <span>Add to Cart</span>
            </Button>
          )}
        </div>
      </div>

      <ChooseAmountModal visible={amountModal.visible} min={amountModal.min} onCancel={onModalCancel} onConfirm={onModalConfirm} />
    </div>
  );
}