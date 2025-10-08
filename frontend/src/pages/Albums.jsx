import React, { useState, useEffect } from "react";
import { Album } from "@/entities/Album";
import { User } from "@/entities/User";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import ContentCard from "../components/content/ContentCard";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Albums() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState([]);
  const [filteredAlbums, setFilteredAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAlbums();
    loadUser();
  }, []);

  useEffect(() => {
    filterAlbums();
  }, [searchTerm, selectedGenre, albums]);

  const loadUser = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {}
  };

  const loadAlbums = async () => {
    setIsLoading(true);
    const data = await Album.list("-created_date");
    setAlbums(data);
    setFilteredAlbums(data);
    setIsLoading(false);
  };

  const filterAlbums = () => {
    let filtered = albums;

    if (searchTerm) {
      filtered = filtered.filter(album =>
        album.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        album.artist.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedGenre !== "all") {
      filtered = filtered.filter(album => album.genre === selectedGenre);
    }

    setFilteredAlbums(filtered);
  };

  const handleAddToCart = async (album) => {
    if (!user) {
      await User.login();
      return;
    }

    const cartItem = {
      item_type: "album",
      item_id: album.id,
      title: album.title,
      price: album.price,
      image: album.cover_image
    };

    const currentCart = user.cart || [];
    const itemExists = currentCart.some(i => i.item_id === album.id);
    
    if (!itemExists) {
      await User.updateMyUserData({ cart: [...currentCart, cartItem] });
      window.location.reload();
    }
  };

  const viewDetails = (id) => {
    navigate(createPageUrl("AlbumDetails") + `?id=${id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Albums</h1>
        <p className="text-gray-400">Discover amazing music from talented artists</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search albums or artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900/50 border-purple-900/20 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="flex items-center gap-2 md:w-64">
          <Filter className="w-5 h-5 text-gray-400" />
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger className="bg-slate-900/50 border-purple-900/20 text-white">
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-purple-900/20">
              <SelectItem value="all">All Genres</SelectItem>
              <SelectItem value="Afrobeats">Afrobeats</SelectItem>
              <SelectItem value="Hip Hop">Hip Hop</SelectItem>
              <SelectItem value="Gospel">Gospel</SelectItem>
              <SelectItem value="Highlife">Highlife</SelectItem>
              <SelectItem value="R&B">R&B</SelectItem>
              <SelectItem value="Reggae">Reggae</SelectItem>
              <SelectItem value="Pop">Pop</SelectItem>
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
      ) : filteredAlbums.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No albums found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredAlbums.map((album) => (
            <ContentCard
              key={album.id}
              item={album}
              type="album"
              onAddToCart={() => handleAddToCart(album)}
              onViewDetails={() => viewDetails(album.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}