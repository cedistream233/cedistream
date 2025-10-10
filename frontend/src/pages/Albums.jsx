import React, { useState, useEffect } from "react";
import { Album } from "@/entities/Album";
import { User } from "@/entities/User";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import ContentCard from "../components/content/ContentCard";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Song } from "@/entities/Song";

export default function Albums() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSongs = location.pathname.toLowerCase().startsWith('/songs');
  const [tab, setTab] = useState('albums'); // 'singles' | 'albums'
  const [albums, setAlbums] = useState([]);
  const [filteredAlbums, setFilteredAlbums] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [singles, setSingles] = useState([]);

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
    const [albumsData, singlesData] = await Promise.all([
      Album.list("-created_date"),
      isSongs ? Song.list({ orderBy: '-created_date' }) : Promise.resolve([])
    ]);
    setAlbums(albumsData);
    setFilteredAlbums(albumsData);
    setSingles(singlesData);
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

    // genre/category filtering removed per new requirements

    setFilteredAlbums(filtered);
  };

  const handleAddToCart = async (album, asSong = false) => {
    if (!user) {
      await User.login();
      return;
    }

    const cartItem = {
      item_type: asSong ? "song" : "album",
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white mb-2">{isSongs ? 'Songs' : 'Albums'}</h1>
        <p className="text-gray-400">{isSongs ? 'Browse singles and full albums' : 'Discover amazing music from talented artists'}</p>
      </div>

      {isSongs && (
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setTab('singles')}
            className={`px-4 py-2 rounded-lg ${tab==='singles' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white hover:bg-purple-900/30'}`}
          >Singles</button>
          <button
            onClick={() => setTab('albums')}
            className={`px-4 py-2 rounded-lg ${tab==='albums' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white hover:bg-purple-900/30'}`}
          >Albums</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search albums or artists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-900/50 border-purple-900/20 text-white placeholder:text-gray-500 h-10"
          />
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
      ) : isSongs && tab === 'singles' ? (
        singles.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No singles found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {singles.map((song) => (
              <ContentCard
                key={song.id}
                // ContentCard expects album/video shape; map song fields accordingly
                item={{
                  id: song.id,
                  title: song.title,
                  artist: song.artist,
                  price: song.price,
                  cover_image: song.cover_image,
                  audio_url: song.audio_url,
                  songs: []
                }}
                type="album"
                onAddToCart={() => handleAddToCart({ id: song.id, title: song.title, price: song.price, cover_image: song.cover_image }, true)}
                onViewDetails={() => navigate(`/songs/${encodeURIComponent(song.id)}`)}
              />
            ))}
          </div>
        )
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