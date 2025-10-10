import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Music2, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function ContentCard({ item, type, onAddToCart, onViewDetails }) {
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
  const [user, setUser] = useState(null);
  const [owned, setOwned] = useState(false);

  useEffect(() => {
    // Prefer a dedicated preview endpoint for songs. We detect songs by presence of audio_url on the card item
    async function loadPreview() {
      if (!item?.id || !item?.audio_url) return;
      setLoadingPreview(true);
      try {
        const res = await fetch(`/api/media/song/${encodeURIComponent(item.id)}/preview`);
        if (res.ok) {
          const d = await res.json();
          setPreviewUrl(d.url || null);
        } else {
          setPreviewUrl(null);
        }
      } catch {
        setPreviewUrl(null);
      } finally { setLoadingPreview(false); }
    }
    loadPreview();
    (async () => {
      try {
        const u = JSON.parse(localStorage.getItem('demo_user') || 'null');
        setUser(u);
        if (u && Array.isArray(u.purchases)) {
          setOwned(u.purchases.some(p => p.item_id === item.id));
        } else {
          setOwned(false);
        }
      } catch {
        setUser(null);
      }
    })();
    return () => { if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current); };
  }, [item?.id, item?.audio_url]);

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
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group relative overflow-hidden bg-slate-900/50 border-purple-900/20 hover:border-purple-500/50 backdrop-blur-sm transition-all duration-300">
        <CardContent className="p-0">
          <div className="relative aspect-square overflow-hidden">
            {image ? (
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
                {previewUrl && (
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
                )}
              </div>

              {/* Bottom action row */}
              <div className="absolute bottom-4 left-4 right-4 flex gap-2 items-center">
                <Button
                  onClick={(e)=>{ e.stopPropagation(); (onViewDetails||(()=>{}))(); }}
                  className="flex-1 bg-white/90 text-black hover:bg-white"
                >
                  View Details
                </Button>
                <Button
                  onClick={(e)=>{ e.stopPropagation(); (onAddToCart||(()=>{}))(); }}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  Buy
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4">
            <h3 className="font-semibold text-white truncate mb-1">{title}</h3>
            <p className="text-sm text-gray-400 truncate mb-1">{creator}</p>
            {publishedDate && (
              <div className="text-[11px] text-gray-400 mb-2">Published {publishedDate}</div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                Pay what you want • Min GH₵ {parseFloat(price)?.toFixed(2) || '0.00'}
              </span>
              {type === "album" && item.songs?.length > 0 && (
                <span className="text-xs text-gray-500">
                  {item.songs.length} tracks
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}