import React, { useEffect, useRef, useState } from "react";
import { buildSrcSet } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Music2, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { setPostAuthIntent } from '@/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function ContentCard({ item, type, onAddToCart, onViewDetails, showPwyw = true, mobileRow = false, desktopRow = false, compact = false }) {
  const { updateMyUserData, user: authUser } = useAuth();
  // prefer cover_image, fallback to thumbnail
  const image = item.cover_image || item.thumbnail || null;
  const title = item.title;
  const creator = item.artist || item.creator;
  const price = item.price;
  const getPublishedDate = () => {
    const raw = item?.release_date || item?.published_at || item?.published_date || item?.released_at || item?.created_at || item?.created_date;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const publishedDate = getPublishedDate();

  const audioRef = useRef(null);
  const previewTimeoutRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [demoUser, setDemoUser] = useState(null);
  const [owned, setOwned] = useState(false);

  useEffect(() => {
    // Prefer a dedicated preview endpoint for songs. We detect songs by presence of audio_url or explicit is_song flag
    async function loadPreview() {
      if (!item?.id || !(item?.audio_url || item?.is_song)) return;

      // Prefer backend preview endpoint (may return a proxy URL with correct CORS)
      setLoadingPreview(true);
      try {
        const { Song } = await import('@/entities/Song');
        const url = await Song.getPreviewUrl(item.id);
        if (url) { setPreviewUrl(url); return; }
      } catch {
        // ignore and fall back to metadata below
      }

      // Fallback: use explicit preview_url metadata only if present
      if (Object.prototype.hasOwnProperty.call(item, 'preview_url')) {
        setPreviewUrl(item.preview_url || null);
      } else {
        setPreviewUrl(null);
      }
      setLoadingPreview(false);
    }
  loadPreview();
    (async () => {
      try {
        // Ownership precedence: server flag -> authenticated user purchases -> demo_user localStorage
        if (typeof item?.owned_by_me === 'boolean') {
          setOwned(Boolean(item.owned_by_me));
        } else if (authUser && Array.isArray(authUser.purchases)) {
          setOwned(authUser.purchases.some(p => p.item_id === item.id));
        } else {
          const u = JSON.parse(localStorage.getItem('demo_user') || 'null');
          setDemoUser(u);
          if (u && Array.isArray(u.purchases)) {
            setOwned(u.purchases.some(p => p.item_id === item.id));
          } else {
            setOwned(false);
          }
        }
      } catch {
        setDemoUser(null);
        setOwned(false);
      }
    })();
    return () => { if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current); };
  }, [item?.id, item?.audio_url, item?.preview_url]);

  const ensureAudio = () => {
    if (!previewUrl) return null;
    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
    }
    if (audioRef.current.src !== previewUrl) audioRef.current.src = previewUrl;
    const el = audioRef.current;
    el.preload = 'metadata';

    // attach listeners if not already
    if (!el._cedi_listeners_attached) {
      const onLoaded = () => setDuration(el.duration || 0);
      const onTime = () => setCurrentTime(el.currentTime || 0);
      const onEnd = () => { setPlaying(false); setCurrentTime(0); if (previewTimeoutRef.current) { clearTimeout(previewTimeoutRef.current); previewTimeoutRef.current = null; } };
      el.addEventListener('loadedmetadata', onLoaded);
      el.addEventListener('timeupdate', onTime);
      el.addEventListener('ended', onEnd);
      el._cedi_listeners_attached = { onLoaded, onTime, onEnd };
    }

    return el;
  };

  const togglePreview = () => {
    if (owned) return;
    const el = ensureAudio();
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    } else {
      try {
        // if resuming from paused position, don't reset to 0
        if (el.currentTime < 0.01) el.currentTime = 0;
        const p = el.play();
        if (p && p.then) {
          p.then(() => setPlaying(true)).catch(()=>{});
        } else {
          setPlaying(true);
        }
        // auto-stop preview after 30s from start
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = setTimeout(() => {
          if (el) el.pause();
          setPlaying(false);
        }, 30000);
      } catch (e) {
        console.warn('Preview play failed', e);
      }
    }
  };

  const replay = (e) => {
    e.stopPropagation();
    const el = ensureAudio();
    if (!el) return;
    el.currentTime = 0; el.play().catch(()=>{}); setPlaying(true);
  };

  return (
    <motion.div
      whileHover={{ y: mobileRow ? 0 : -8 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        role={onViewDetails ? 'button' : undefined}
        tabIndex={onViewDetails ? 0 : undefined}
        onClick={onViewDetails ? (() => (onViewDetails || (() => {}))()) : undefined}
        onKeyDown={onViewDetails ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onViewDetails||(()=>{}))(); } }) : undefined}
        className={`group relative overflow-hidden bg-slate-900/50 border-purple-900/20 hover:border-purple-500/50 backdrop-blur-sm transition-all duration-300 ${onViewDetails ? 'cursor-pointer' : ''}`}
      >
        <CardContent className={mobileRow ? "p-0 flex items-center gap-3 sm:block" : (desktopRow ? "p-0 flex items-center gap-4" : "p-0")}>
          {/* DesktopRow: YouTube-like horizontal item (thumbnail left, details right). mobileRow: compact on phones. Default: grid-style square thumbnail. */}
          <div className={`relative overflow-hidden ${mobileRow ? 'w-28 h-20 flex-shrink-0 sm:w-full sm:h-auto sm:aspect-square' : (desktopRow ? 'w-56 h-32 flex-shrink-0 md:w-64 md:h-36 lg:w-72 lg:h-40' : (compact ? 'w-full h-20 sm:h-20 md:h-24 lg:h-24' : 'w-full h-36 sm:h-32 md:h-28 lg:h-32'))}`}>
            {image ? (
              <img
                  src={image}
                  alt={title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                  srcSet={buildSrcSet(image) || undefined}
                  sizes="(max-width: 640px) 100vw, 320px"
                />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                {type === "album" ? (
                  <Music2 className="w-16 h-16 text-purple-300" />
                ) : (
                  <Play className="w-16 h-16 text-purple-300" />
                )}
              </div>
            )}
            
            {/* Hide overlay for compact rows */}
            <div className={(mobileRow || desktopRow) ? "hidden" : "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300"}>
              {/* Locked badge + preview indicator */}
              <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                {!owned && (
                  <div className="text-[11px] uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Locked</span>
                  </div>
                )}
                {/* Keep left badges compact; main 'Preview' label appears under the play button */}
              </div>
              {/* Center play button */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {previewUrl && !owned ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-18 h-18">
                      {/* circular progress ring */}
                      <svg className="w-20 h-20" viewBox="0 0 36 36">
                        <defs>
                          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#7c3aed" />
                            <stop offset="100%" stopColor="#ec4899" />
                          </linearGradient>
                        </defs>
                        {/* background ring */}
                        <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="2" stroke="rgba(255,255,255,0.06)" />
                        {/* progress ring: circumference is 100 (r chosen accordingly). strokeDashoffset flips so 0 => empty, 100 => full */}
                        <circle
                          cx="18"
                          cy="18"
                          r="15.9155"
                          fill="none"
                          strokeWidth="2"
                          stroke="url(#grad1)"
                          strokeDasharray="100"
                          strokeDashoffset={100 - (duration > 0 ? (currentTime / duration * 100) : 0)}
                          strokeLinecap="round"
                          transform="rotate(-90 18 18)"
                          style={{ transition: 'stroke-dashoffset 120ms linear' }}
                        />
                      </svg>

                      <button
                        onClick={(e) => { e.stopPropagation(); togglePreview(); }}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto w-14 h-14 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg"
                        aria-label={playing ? 'Pause preview' : 'Play preview'}
                      >
                        {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                      </button>
                    </div>
                    <div className="text-[11px] text-white/90 bg-purple-700/80 px-2 py-0.5 rounded-full">Preview</div>
                  </div>
                ) : null}
              </div>

              {/* Bottom action row */}
              <div className="absolute bottom-4 left-4 right-4 flex gap-2 items-center">
                {owned ? (
                  <Button
                    onClick={(e)=>{ e.stopPropagation();
                      if (type === 'song') window.location.href = `/songs/${item.id}?autoplay=1`;
                      else if (type === 'album') window.location.href = `/albums/${item.id}`;
                      else if (type === 'video') window.location.href = `/videos/${item.id}`;
                    }}
                    className={`flex-1 text-white ${
                      type === 'song' || type === 'video'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {type === 'song' || type === 'video' ? 'Play' : 'Open'}
                  </Button>
                ) : (
                  <>
                    {!mobileRow && (
                      <Button
                        onClick={(e)=>{ e.stopPropagation(); (onViewDetails||(()=>{}))(); }}
                        className="flex-1 bg-white/90 text-black hover:bg-white"
                      >
                        View Details
                      </Button>
                    )}
                    {type !== 'album' && (
                      <Button
                        onClick={async (e)=>{
                          e.stopPropagation();
                          // Delegate to parent if it wants to handle add-to-cart (e.g., open modal)
                          if (onAddToCart) return onAddToCart();

                          const token = localStorage.getItem('token');
                          const min = Number(price || 0);
                          if (!token) {
                            try {
                              setPostAuthIntent({
                                action: 'add-to-cart',
                                item: {
                                  item_type: type,
                                  item_id: item.id,
                                  title: title,
                                  price: min,
                                  min_price: min,
                                  image: item.cover_image || item.thumbnail || null,
                                },
                                redirect: '/cart'
                              });
                            } catch {}
                            window.location.href = '/signup';
                            return;
                          }

                          // Authenticated: update cart in user/demo_user (use updateMyUserData when available)
                          try {
                            const cartItem = {
                              item_type: type,
                              item_id: item.id,
                              title: title,
                              price: min,
                              min_price: min,
                              image: item.cover_image || item.thumbnail || null,
                            };
                            const u = JSON.parse(localStorage.getItem('user') || 'null') || JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
                            const currentCart = (u?.cart) || [];
                            const exists = currentCart.some(i => i.item_id === item.id && i.item_type === type);
                            if (!exists) {
                              if (updateMyUserData) {
                                await updateMyUserData({ cart: [...currentCart, cartItem] });
                              } else {
                                const next = { ...(u||{}), cart: [...currentCart, cartItem] };
                                try { localStorage.setItem('demo_user', JSON.stringify(next)); } catch {}
                                try { localStorage.setItem('user', JSON.stringify(next)); } catch {}
                              }
                            }
                          } catch (err) { console.error(err); }

                          // navigate to cart for checkout
                          window.location.href = '/cart';
                        }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        Buy
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={mobileRow ? "flex-1 p-3 sm:p-4" : (desktopRow ? 'flex-1 p-3' : (compact ? 'p-2' : 'p-3'))}>
            <h3 className={`font-semibold text-white mb-0 ${mobileRow ? 'text-sm sm:text-base line-clamp-2 sm:truncate' : (desktopRow ? 'text-base lg:text-lg line-clamp-2' : (compact ? 'text-sm line-clamp-2' : 'truncate text-sm'))}`}>{title}</h3>
            <p className={`text-gray-400 mb-0 ${mobileRow ? 'text-xs sm:text-sm line-clamp-1 sm:truncate' : (compact ? 'text-xs truncate' : 'text-sm truncate')}`}>{creator}</p>
            {publishedDate && (
              <div className={`text-gray-400 ${mobileRow ? 'text-xs sm:text-sm mb-1 sm:mb-2' : (compact ? 'text-xs mb-1' : 'text-sm mb-2')}`}>Published {publishedDate}</div>
            )}
            {!mobileRow && (
              <div className="flex items-center justify-between">
                {showPwyw ? (
                  <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-300`}>Pay what you want • Min GH₵ {parseFloat(price)?.toFixed(2) || '0.00'}</span>
                ) : (
                  // Always show price/min info in the bottom row. The published date is already shown above
                  <span className={`${compact ? 'text-xs' : 'text-sm'} text-gray-300`}>Min GH₵ {parseFloat(price)?.toFixed(2) || '0.00'}</span>
                )}
                {type === "album" && item.songs?.length > 0 && (
                  <span className={`text-xs text-gray-500 ${compact ? 'hidden' : ''}`}>
                    {item.songs.length} tracks
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}