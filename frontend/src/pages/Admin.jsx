import React, { useState } from "react";
import { Album } from "@/entities/Album";
import { Video } from "@/entities/Video";
import { User } from "@/entities/User";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Music, Video as VideoIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Admin() {
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [albumData, setAlbumData] = useState({
    title: "",
    artist: "",
    description: "",
    price: "",
    genre: "Afrobeats",
    cover_image: "",
    release_date: ""
  });

  const [videoData, setVideoData] = useState({
    title: "",
    creator: "",
    description: "",
    price: "",
    category: "Music Video",
    thumbnail: "",
    video_url: "",
    duration: "",
    release_date: ""
  });

  const handleAlbumSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await Album.create({ ...albumData, price: parseFloat(albumData.price) });
    setAlbumData({ title: "", artist: "", description: "", price: "", genre: "Afrobeats", cover_image: "", release_date: "" });
    setShowAlbumForm(false);
    setIsSubmitting(false);
  };

  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await Video.create({ ...videoData, price: parseFloat(videoData.price) });
    setVideoData({ title: "", creator: "", description: "", price: "", category: "Music Video", thumbnail: "", video_url: "", duration: "", release_date: "" });
    setShowVideoForm(false);
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-4xl font-bold text-white mb-8">Admin Panel</h1>

      <Alert className="mb-8 bg-blue-900/20 border-blue-500/50">
        <AlertDescription className="text-blue-200">
          Manage your content inventory. Add new albums and videos for sale.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="albums">
        <TabsList className="bg-slate-900/50 mb-8">
          <TabsTrigger value="albums">
            <Music className="w-4 h-4 mr-2" />
            Manage Albums
          </TabsTrigger>
          <TabsTrigger value="videos">
            <VideoIcon className="w-4 h-4 mr-2" />
            Manage Videos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="albums">
          {!showAlbumForm ? (
            <Button
              onClick={() => setShowAlbumForm(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Album
            </Button>
          ) : (
            <Card className="bg-slate-900/50 border-purple-900/20 p-6">
              <h3 className="text-2xl font-bold text-white mb-6">Add New Album</h3>
              <form onSubmit={handleAlbumSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Title *</Label>
                    <Input
                      required
                      value={albumData.title}
                      onChange={(e) => setAlbumData({...albumData, title: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Artist *</Label>
                    <Input
                      required
                      value={albumData.artist}
                      onChange={(e) => setAlbumData({...albumData, artist: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Price (GH₵) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      required
                      value={albumData.price}
                      onChange={(e) => setAlbumData({...albumData, price: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Genre</Label>
                    <Select
                      value={albumData.genre}
                      onValueChange={(value) => setAlbumData({...albumData, genre: value})}
                    >
                      <SelectTrigger className="bg-slate-800 border-purple-900/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-purple-900/20">
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
                  <div>
                    <Label className="text-white">Cover Image URL</Label>
                    <Input
                      value={albumData.cover_image}
                      onChange={(e) => setAlbumData({...albumData, cover_image: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label className="text-white">Release Date</Label>
                    <Input
                      type="date"
                      value={albumData.release_date}
                      onChange={(e) => setAlbumData({...albumData, release_date: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-white">Description</Label>
                  <Textarea
                    value={albumData.description}
                    onChange={(e) => setAlbumData({...albumData, description: e.target.value})}
                    className="bg-slate-800 border-purple-900/20 text-white h-24"
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                    {isSubmitting ? "Adding..." : "Add Album"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAlbumForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="videos">
          {!showVideoForm ? (
            <Button
              onClick={() => setShowVideoForm(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Video
            </Button>
          ) : (
            <Card className="bg-slate-900/50 border-purple-900/20 p-6">
              <h3 className="text-2xl font-bold text-white mb-6">Add New Video</h3>
              <form onSubmit={handleVideoSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Title *</Label>
                    <Input
                      required
                      value={videoData.title}
                      onChange={(e) => setVideoData({...videoData, title: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Creator *</Label>
                    <Input
                      required
                      value={videoData.creator}
                      onChange={(e) => setVideoData({...videoData, creator: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Price (GH₵) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      required
                      value={videoData.price}
                      onChange={(e) => setVideoData({...videoData, price: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Category</Label>
                    <Select
                      value={videoData.category}
                      onValueChange={(value) => setVideoData({...videoData, category: value})}
                    >
                      <SelectTrigger className="bg-slate-800 border-purple-900/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-purple-900/20">
                        <SelectItem value="Music Video">Music Video</SelectItem>
                        <SelectItem value="Tutorial">Tutorial</SelectItem>
                        <SelectItem value="Entertainment">Entertainment</SelectItem>
                        <SelectItem value="Documentary">Documentary</SelectItem>
                        <SelectItem value="Vlog">Vlog</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Thumbnail URL</Label>
                    <Input
                      value={videoData.thumbnail}
                      onChange={(e) => setVideoData({...videoData, thumbnail: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label className="text-white">Video URL</Label>
                    <Input
                      value={videoData.video_url}
                      onChange={(e) => setVideoData({...videoData, video_url: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label className="text-white">Duration</Label>
                    <Input
                      value={videoData.duration}
                      onChange={(e) => setVideoData({...videoData, duration: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                      placeholder="e.g., 3:45"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Release Date</Label>
                    <Input
                      type="date"
                      value={videoData.release_date}
                      onChange={(e) => setVideoData({...videoData, release_date: e.target.value})}
                      className="bg-slate-800 border-purple-900/20 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-white">Description</Label>
                  <Textarea
                    value={videoData.description}
                    onChange={(e) => setVideoData({...videoData, description: e.target.value})}
                    className="bg-slate-800 border-purple-900/20 text-white h-24"
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                    {isSubmitting ? "Adding..." : "Add Video"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowVideoForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}