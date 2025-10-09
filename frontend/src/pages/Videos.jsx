import React, { useState, useEffect } from "react";
import { Video } from "@/entities/Video";
import { User } from "@/entities/User";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import ContentCard from "../components/content/ContentCard";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Videos() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVideos();
    loadUser();
  }, []);

  useEffect(() => {
    filterVideos();
  }, [searchTerm, selectedCategory, videos]);

  const loadUser = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {}
  };

  const loadVideos = async () => {
    setIsLoading(true);
    const data = await Video.list("-created_date");
    setVideos(data);
    setFilteredVideos(data);
    setIsLoading(false);
  };

  const filterVideos = () => {
    let filtered = videos;

    if (searchTerm) {
      filtered = filtered.filter(video =>
        video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.creator.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(video => video.category === selectedCategory);
    }

    setFilteredVideos(filtered);
  };

  const handleAddToCart = async (video) => {
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
      window.location.reload();
    }
  };

  const viewDetails = (id) => {
    navigate(createPageUrl("VideoDetails") + `?id=${id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white mb-2">Videos</h1>
        <p className="text-gray-400">Exclusive content from top creators</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search videos or creators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-900/50 border-purple-900/20 text-white placeholder:text-gray-500 h-10"
          />
        </div>
        <div className="flex items-center gap-2 md:w-64">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="bg-slate-900/50 border-purple-900/20 text-white h-10">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-purple-900/20">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Music Video">Music Video</SelectItem>
              <SelectItem value="Tutorial">Tutorial</SelectItem>
              <SelectItem value="Entertainment">Entertainment</SelectItem>
              <SelectItem value="Documentary">Documentary</SelectItem>
              <SelectItem value="Vlog">Vlog</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-slate-800 rounded-lg mb-4"></div>
              <div className="h-4 bg-slate-800 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No videos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <ContentCard
              key={video.id}
              item={video}
              type="video"
              onAddToCart={() => handleAddToCart(video)}
              onViewDetails={() => viewDetails(video.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}