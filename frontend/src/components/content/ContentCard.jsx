import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, ShoppingCart, Music2 } from "lucide-react";
import { motion } from "framer-motion";
import { Pause, RotateCcw } from "lucide-react";

export default function ContentCard({ item, type, onAddToCart, onViewDetails }) {
  // prefer cover_image, fallback to thumbnail
  const image = item.cover_image || item.thumbnail || null;
  const title = item.title;
  const creator = item.artist || item.creator;
  const price = item.price;

  const audioRef = useRef(null);
  const previewTimeoutRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
    return () => { if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current); };
  }, [item?.id, item?.audio_url]);

  const ensureAudio = () => {
    if (!previewUrl) return null;
    if (!audioRef.current) audioRef.current = new Audio(previewUrl);
    if (audioRef.current.src !== previewUrl) audioRef.current.src = previewUrl;
    audioRef.current.preload = 'metadata';
    return audioRef.current;
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
        el.currentTime = 0;
        el.play();
        setPlaying(true);
        // auto-stop preview after 30s
        previewTimeoutRef.current = setTimeout(() => {
          if (el) el.pause();
          setPlaying(false);
        }, 30000);
      } catch (e) {
        // play might be blocked by browser autoplay policies
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
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-4 left-4 right-4 flex gap-2 items-center">
                {type === 'album' && previewUrl && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); togglePreview(); }}
                    size="icon"
                    className="bg-white/90 text-black hover:bg-white"
                    aria-label={playing ? 'Pause preview' : 'Play preview'}
                  >
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                )}
                {type === 'album' && previewUrl && (
                  <Button onClick={(e)=>{ e.stopPropagation(); replay(e); }} size="icon" variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  onClick={onViewDetails}
                  className="flex-1 bg-white/90 text-black hover:bg-white"
                >
                  View Details
                </Button>
                <Button
                  onClick={onAddToCart}
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4">
            <h3 className="font-semibold text-white truncate mb-1">{title}</h3>
            <p className="text-sm text-gray-400 truncate mb-3">{creator}</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-yellow-400">
                From GH₵ {parseFloat(price)?.toFixed(2) || '0.00'}
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