import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Purchase } from "@/entities/Purchase";
import { Album } from "@/entities/Album";
import { Video } from "@/entities/Video";
import { Song } from "@/entities/Song";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Music, Video as VideoIcon, Download, Play } from "lucide-react";
import PurchasedSongRow from '@/components/content/PurchasedSongRow';
import PurchasedAlbumRow from '@/components/content/PurchasedAlbumRow';
import PurchasedVideoRow from '@/components/content/PurchasedVideoRow';
import { Button } from "@/components/ui/button";

export default function Library() {
  const [user, setUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchasedItems, setPurchasedItems] = useState({ albums: [], songs: [], videos: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      setUser(userData);

      const userPurchases = await Purchase.filter({
        user_email: userData.email,
        payment_status: "completed"
      });
      setPurchases(userPurchases);

      const albumIds = userPurchases.filter(p => p.item_type === "album").map(p => p.item_id);
      const videoIds = userPurchases.filter(p => p.item_type === "video").map(p => p.item_id);
      const songIds = userPurchases.filter(p => p.item_type === "song").map(p => p.item_id);

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

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-800 rounded w-64"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="aspect-square bg-slate-800 rounded-lg mb-4"></div>
                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold text-white mb-2">My Library</h1>
      <p className="text-gray-400 mb-8">Access your purchased content anytime</p>

      <Tabs defaultValue="albums" className="w-full">
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
          {purchasedItems.albums.length === 0 ? (
            <div className="text-center py-16">
              <Music className="w-24 h-24 mx-auto text-gray-600 mb-6" />
              <p className="text-gray-400 text-lg">No albums purchased yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {purchasedItems.albums.map((album) => (
                <PurchasedAlbumRow key={album.id} album={album} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="songs">
          {purchasedItems.songs.length === 0 ? (
            <div className="text-center py-16">
              <Music className="w-24 h-24 mx-auto text-gray-600 mb-6" />
              <p className="text-gray-400 text-lg">No songs purchased yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {purchasedItems.songs.map((song) => (
                <PurchasedSongRow key={song.id} song={song} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="videos">
          {purchasedItems.videos.length === 0 ? (
            <div className="text-center py-16">
              <VideoIcon className="w-24 h-24 mx-auto text-gray-600 mb-6" />
              <p className="text-gray-400 text-lg">No videos purchased yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {purchasedItems.videos.map((video) => (
                <PurchasedVideoRow key={video.id} video={video} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}