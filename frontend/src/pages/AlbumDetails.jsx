import React, { useState, useEffect } from "react";
import { Album } from "@/entities/Album";
import { User } from "@/entities/User";
import { Song } from "@/entities/Song";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ShoppingCart, Music, Clock, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import ChooseAmountModal from '@/components/ui/ChooseAmountModal';
import AudioPlayer from '@/components/media/AudioPlayer';

export default function AlbumDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const albumId = urlParams.get("id");
  
  const [album, setAlbum] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchased, setPurchased] = useState(false);
  const [trackAudioUrls, setTrackAudioUrls] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loopMode, setLoopMode] = useState('off'); // 'off' | 'one' | 'all'
  const [amountModal, setAmountModal] = useState({ visible: false, min: 0 });

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

  const loadAlbum = async () => {
    setIsLoading(true);
    const albums = await Album.list();
    const foundAlbum = albums.find(a => a.id === albumId);
    setAlbum(foundAlbum);
    setIsLoading(false);
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
      const map = {};
      for (const s of album.songs) {
        let url = null;
        if (purchased) {
          url = await Song.getSignedUrl(s.id, localStorage.getItem('token'));
        }
        if (!url) {
          url = await Song.getPreviewUrl(s.id);
        }
        if (url) map[s.id] = url;
      }
      setTrackAudioUrls(map);
    })();
  }, [album?.songs, purchased]);

  const onPrev = () => {
    if (!album?.songs?.length) return;
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
    else if (loopMode === 'all') setCurrentIndex(album.songs.length - 1);
  };
  const onNext = () => {
    if (!album?.songs?.length) return;
    if (currentIndex < album.songs.length - 1) setCurrentIndex(currentIndex + 1);
    else if (loopMode === 'all') setCurrentIndex(0);
  };

  const handleAddToCart = async () => {
    if (!user) {
      await User.login();
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

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-800 rounded w-32 mb-8"></div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-slate-800 rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-12 bg-slate-800 rounded"></div>
              <div className="h-6 bg-slate-800 rounded w-3/4"></div>
              <div className="h-32 bg-slate-800 rounded"></div>
            </div>
          </div>
        </div>
        <ChooseAmountModal visible={amountModal.visible} min={amountModal.min} onCancel={onModalCancel} onConfirm={onModalConfirm} />
      </div>
    );
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
      <Button
        variant="ghost"
        onClick={() => navigate(createPageUrl("Albums"))}
        className="mb-8 text-purple-400 hover:text-purple-300"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Albums
      </Button>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
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
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{album.title}</h1>
            <p className="text-2xl text-purple-400 mb-6">{album.artist}</p>
            {album.description && (
              <p className="text-gray-400 text-lg">{album.description}</p>
            )}
          </div>

          <div className="flex items-center gap-6 mb-8 text-gray-400">
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

          <div className="bg-slate-900/50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Minimum price:</span>
              <span className="text-3xl font-bold text-yellow-400">From GH₵ {album.price?.toFixed(2)}</span>
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

      {album.songs?.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Now Playing</h2>
          <div className="mb-6">
            <AudioPlayer
              src={trackAudioUrls[album.songs[currentIndex]?.id]}
              title={album.songs[currentIndex]?.title || 'Track'}
              artwork={album.cover_image}
              showPreviewBadge={!purchased}
              onEnded={() => { if (loopMode !== 'one') onNext(); }}
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
                  onClick={() => setCurrentIndex(index)}
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
                      {trackAudioUrls[song.id] ? (index===currentIndex ? 'Playing' : 'Tap to play') : 'No preview'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}