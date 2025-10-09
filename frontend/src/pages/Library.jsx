import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Purchase } from "@/entities/Purchase";
import { Album } from "@/entities/Album";
import { Video } from "@/entities/Video";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Music, Video as VideoIcon, Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Library() {
  const [user, setUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchasedItems, setPurchasedItems] = useState({ albums: [], videos: [] });
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

      const [allAlbums, allVideos] = await Promise.all([
        Album.list(),
        Video.list()
      ]);

      setPurchasedItems({
        albums: allAlbums.filter(a => albumIds.includes(a.id)),
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
            Songs ({purchasedItems.albums.length})
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {purchasedItems.albums.map((album) => (
                <Card key={album.id} className="bg-slate-900/50 border-purple-900/20 overflow-hidden group">
                  <div className="relative aspect-square">
                    {album.cover_image ? (
                      <img src={album.cover_image} alt={album.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                        <Music className="w-16 h-16 text-purple-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="icon" className="bg-white text-black hover:bg-gray-200">
                        <Play className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white truncate">{album.title}</h3>
                    <p className="text-sm text-gray-400 truncate">{album.artist}</p>
                  </div>
                </Card>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {purchasedItems.videos.map((video) => (
                <Card key={video.id} className="bg-slate-900/50 border-purple-900/20 overflow-hidden group">
                  <div className="relative aspect-square">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                        <Play className="w-16 h-16 text-purple-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="icon" className="bg-white text-black hover:bg-gray-200">
                        <Play className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white truncate">{video.title}</h3>
                    <p className="text-sm text-gray-400 truncate">{video.creator}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}