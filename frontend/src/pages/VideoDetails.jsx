import React, { useState, useEffect } from "react";
import { Video } from "@/entities/Video";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, Play, Clock, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function VideoDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get("id");
  
  const [video, setVideo] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);

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
      const token = localStorage.getItem('token');
      // try to get signed full video URL if authorized
      let signed = null;
      if (token) {
        const res = await fetch(`/api/media/video/${video.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json(); signed = d.url; setCanAccess(true); setMediaUrl(d.url); return;
        }
      }
      // fallback to preview
      const prevRes = await fetch(`/api/media/video/${video.id}/preview`);
      if (prevRes.ok) {
        const d = await prevRes.json(); setMediaUrl(d.url); setCanAccess(false);
      } else {
        setMediaUrl(null); setCanAccess(false);
      }
    })();
  }, [video?.id]);

  const handleAddToCart = async () => {
    if (!user) {
      await User.login();
      return;
    }

    const cartItem = {
      item_type: "video",
      item_id: video.id,
      title: video.title,
      price: video.price,
      image: video.thumbnail
    };

    const currentCart = user.cart || [];
    const itemExists = currentCart.some(i => i.item_id === video.id);
    
    if (!itemExists) {
      await User.updateMyUserData({ cart: [...currentCart, cartItem] });
      navigate(createPageUrl("Cart"));
    }
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

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          {mediaUrl ? (
            <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black">
              <video controls src={mediaUrl} className="w-full h-full object-cover" />
              {!canAccess && <div className="absolute top-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Preview</div>}
            </div>
          ) : (
            video.thumbnail ? (
              <div className="relative group">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full rounded-2xl shadow-2xl"
                />
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
              <span className="text-gray-400">Price:</span>
              <span className="text-3xl font-bold text-yellow-400">GH₵ {video.price?.toFixed(2)}</span>
            </div>
          </div>

          <Button
            onClick={handleAddToCart}
            size="lg"
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}