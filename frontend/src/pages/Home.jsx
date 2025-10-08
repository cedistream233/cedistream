import React, { useState, useEffect } from "react";
import { Album } from "@/entities/Album";
import { Video } from "@/entities/Video";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Sparkles, TrendingUp, ArrowRight } from "lucide-react";
import ContentCard from "../components/content/ContentCard";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [featuredAlbums, setFeaturedAlbums] = useState([]);
  const [featuredVideos, setFeaturedVideos] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadContent();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {
      // Not logged in
    }
  };

  const loadContent = async () => {
    setIsLoading(true);
    const [albums, videos] = await Promise.all([
      Album.list("-created_date", 4),
      Video.list("-created_date", 4)
    ]);
    setFeaturedAlbums(albums);
    setFeaturedVideos(videos);
    setIsLoading(false);
  };

  const handleAddToCart = async (item, type) => {
    if (!user) {
      await User.login();
      return;
    }

    const cartItem = {
      item_type: type,
      item_id: item.id,
      title: item.title,
      price: item.price,
      image: type === "album" ? item.cover_image : item.thumbnail
    };

    const currentCart = user.cart || [];
    const itemExists = currentCart.some(i => i.item_id === item.id);
    
    if (!itemExists) {
      await User.updateMyUserData({ cart: [...currentCart, cartItem] });
      window.location.reload();
    }
  };

  const viewDetails = (id, type) => {
    navigate(createPageUrl(type === "album" ? "AlbumDetails" : "VideoDetails") + `?id=${id}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              <span className="text-yellow-400 font-medium">Premium Content Marketplace</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Discover Amazing
              <span className="block bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">
                Music & Videos
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Support your favorite artists and creators. Purchase exclusive content with secure mobile money or card payments.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to={createPageUrl("Albums")}>
                <Button size="lg" className="bg-white text-purple-900 hover:bg-gray-100">
                  Browse Albums
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to={createPageUrl("Videos")}>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  Explore Videos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Albums */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-purple-400 font-medium">Latest Releases</span>
            </div>
            <h2 className="text-3xl font-bold text-white">Featured Albums</h2>
          </div>
          <Link to={createPageUrl("Albums")}>
            <Button variant="ghost" className="text-purple-400 hover:text-purple-300">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-slate-800 rounded-lg mb-4"></div>
                <div className="h-4 bg-slate-800 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-800 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredAlbums.map((album) => (
              <ContentCard
                key={album.id}
                item={album}
                type="album"
                onAddToCart={() => handleAddToCart(album, "album")}
                onViewDetails={() => viewDetails(album.id, "album")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Featured Videos */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-pink-400" />
              <span className="text-sm text-pink-400 font-medium">Hot Content</span>
            </div>
            <h2 className="text-3xl font-bold text-white">Featured Videos</h2>
          </div>
          <Link to={createPageUrl("Videos")}>
            <Button variant="ghost" className="text-pink-400 hover:text-pink-300">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-slate-800 rounded-lg mb-4"></div>
                <div className="h-4 bg-slate-800 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-800 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredVideos.map((video) => (
              <ContentCard
                key={video.id}
                item={video}
                type="video"
                onAddToCart={() => handleAddToCart(video, "video")}
                onViewDetails={() => viewDetails(video.id, "video")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}