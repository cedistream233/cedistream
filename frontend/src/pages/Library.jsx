import React, { useState, useEffect } from "react";
import { Purchase } from "@/entities/Purchase";
import { Album } from "@/entities/Album";
import { Video } from "@/entities/Video";
import { Song } from "@/entities/Song";
import { Card } from "@/components/ui/card";
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Music, Video as VideoIcon, Download, Play, Search } from "lucide-react";
import ContentRow from '@/components/content/ContentRow';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';

export default function Library() {
  const { user, token } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [purchasedItems, setPurchasedItems] = useState({ albums: [], songs: [], videos: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const q = (search || '').trim().toLowerCase();
  const filteredAlbums = q ? purchasedItems.albums.filter(a => ((a.title||'').toLowerCase().includes(q) || (a.artist||'').toLowerCase().includes(q))) : purchasedItems.albums;
  const filteredSongs = q ? purchasedItems.songs.filter(s => ((s.title||'').toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q))) : purchasedItems.songs;
  const filteredVideos = q ? purchasedItems.videos.filter(v => ((v.title||'').toLowerCase().includes(q) || (v.creator||'').toLowerCase().includes(q))) : purchasedItems.videos;

  useEffect(() => {
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      if (!token) {
        setPurchases([]);
        setPurchasedItems({ albums: [], songs: [], videos: [] });
        setIsLoading(false);
        return;
      }

      // Fetch authenticated user's purchases only
      const userPurchases = await Purchase.filter({ me: 'true' });
      const filtered = (Array.isArray(userPurchases) ? userPurchases : []).filter(p => (
        p.payment_status === 'completed' || p.payment_status === 'success'
      ));
      setPurchases(filtered);

      const albumIds = filtered.filter(p => p.item_type === "album").map(p => p.item_id);
      const videoIds = filtered.filter(p => p.item_type === "video").map(p => p.item_id);
      const songIds = filtered.filter(p => p.item_type === "song").map(p => p.item_id);

      const [allAlbums, allVideos, allSongs] = await Promise.all([
        Album.list(),
        Video.list(),
        Song.list()
      ]);

      setPurchasedItems({
        albums: allAlbums.filter(a => albumIds.includes(a.id)),
        songs: allSongs.filter(s => songIds.includes(s.id)),
        videos: allVideos.filter(v => videoIds.includes(v.id))
      });
    } catch (error) {
      console.error("Error loading library:", error);
    }
    setIsLoading(false);
  };

  if (isLoading) return <LoadingOverlay text="Loading library" />;

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">My Library</h1>
        <p className="text-gray-400 mb-6">Sign in to view your purchased content.</p>
        <div className="flex justify-center gap-3">
          <a href="/login" className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white">Log in</a>
          <a href="/signup" className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700">Create account</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold text-white mb-2">My Library</h1>
      <p className="text-gray-400 mb-8">Access your purchased content anytime</p>

      {/* Search bar: filters library lists by title and artist/creator */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            aria-label="Search your library"
            placeholder="Search your library (title, artist or creator)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-md bg-slate-800/60 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>
        {search ? (
          <button onClick={() => setSearch('')} className="text-sm text-gray-400 hover:text-white">Clear</button>
        ) : null}
      </div>

      <Tabs defaultValue="albums" className="w-full">
        {/* compute filters for rendering */}
        
        <TabsList className="bg-slate-900/50 mb-8">
          <TabsTrigger value="albums" className="flex items-center gap-2">
            <Music className="w-4 h-4" />
            Albums ({purchasedItems.albums.length})
          </TabsTrigger>
            <TabsTrigger value="songs" className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              Songs ({purchasedItems.songs.length})
            </TabsTrigger>
          <TabsTrigger value="videos" className="flex items-center gap-2">
            <VideoIcon className="w-4 h-4" />
            Videos ({purchasedItems.videos.length})
          </TabsTrigger>
        </TabsList>

  <TabsContent value="albums">
          {(!q && purchasedItems.albums.length === 0) ? (
            <div className="text-center py-16">
              <Music className="w-24 h-24 mx-auto text-gray-600 mb-6" />
              <p className="text-gray-400 text-lg">No albums purchased yet</p>
            </div>
          ) : (filteredAlbums.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">No results</p>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-900/50 border border-purple-900/20 overflow-hidden divide-y divide-slate-800">
              {filteredAlbums.map((album) => (
                <ContentRow
                  key={album.id}
                  noCard={true}
                  item={{
                    id: album.id,
                    title: album.title,
                    artist: album.artist || '',
                    cover_image: album.cover_image || album.thumbnail,
                    owned_by_me: true,
                    songs: album.songs,
                  }}
                  type="album"
                  onViewDetails={() => window.location.href = `/albums/${encodeURIComponent(album.id)}`}
                  showPwyw={false}
                />
              ))}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="songs">
          {(!q && purchasedItems.songs.length === 0) ? (
            <div className="text-center py-16">
              <Music className="w-24 h-24 mx-auto text-gray-600 mb-6" />
              <p className="text-gray-400 text-lg">No songs purchased yet</p>
            </div>
          ) : (filteredSongs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">No results</p>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-900/50 border border-purple-900/20 overflow-hidden divide-y divide-slate-800">
              {filteredSongs.map((song) => (
                <ContentRow
                  key={song.id}
                  noCard={true}
                  item={{
                    id: song.id,
                    title: song.title,
                    artist: song.artist || '',
                    cover_image: song.cover_image,
                    owned_by_me: true,
                  }}
                  type="song"
                  onViewDetails={() => window.location.href = `/songs/${encodeURIComponent(song.id)}`}
                  showPwyw={false}
                />
              ))}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="videos">
          {(!q && purchasedItems.videos.length === 0) ? (
            <div className="text-center py-16">
              <VideoIcon className="w-24 h-24 mx-auto text-gray-600 mb-6" />
              <p className="text-gray-400 text-lg">No videos purchased yet</p>
            </div>
          ) : (filteredVideos.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">No results</p>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-900/50 border border-purple-900/20 overflow-hidden divide-y divide-slate-800">
              {filteredVideos.map((video) => (
                <ContentRow
                  key={video.id}
                  noCard={true}
                  item={{
                    id: video.id,
                    title: video.title,
                    artist: video.creator || '',
                    cover_image: video.cover_image || video.thumbnail,
                    owned_by_me: true,
                  }}
                  type="video"
                  onViewDetails={() => window.location.href = `/videos/${encodeURIComponent(video.id)}`}
                  showPwyw={false}
                />
              ))}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}