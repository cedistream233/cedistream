import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Image as ImageIcon, Music } from 'lucide-react';
import CropperModal from '@/components/ui/CropperModal';

export default function UploadSong() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [genre, setGenre] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [cover, setCover] = useState(null);
  const [audio, setAudio] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const coverRef = useRef(null);
  const audioRef = useRef(null);
  const previewRef = useRef(null);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  const [pendingCover, setPendingCover] = useState(null);

  const submit = async () => {
    setError(''); setSuccess(''); setBusy(true);
    try {
      if (!title || !price || !audio) throw new Error('Title, price and audio are required');
      const fd = new FormData();
      fd.append('title', title);
      if (description) fd.append('description', description);
      fd.append('price', price);
      if (genre) fd.append('genre', genre);
      if (releaseDate) fd.append('release_date', releaseDate);
      fd.append('audio', audio);
      if (cover) fd.append('cover', cover);
      if (preview) fd.append('preview', preview);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/uploads/songs', {
        method: 'POST',
        headers: { Authorization: token ? `Bearer ${token}` : '' },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSuccess('Song published!');
      setTitle(''); setDescription(''); setPrice(''); setGenre(''); setReleaseDate(''); setCover(null); setAudio(null); setPreview(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Upload New Song</h1>
      {error && <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-600 rounded p-2">{error}</div>}
      {success && <div className="mb-4 text-sm text-green-300 bg-green-500/10 border border-green-600 rounded p-2">{success}</div>}

      <Card className="bg-slate-900/50 border-purple-900/20 mb-6">
        <CardHeader>
          <CardTitle className="text-white">Song Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title</label>
              <Input value={title} onChange={e=>setTitle(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Minimum Price (GHS)</label>
              <Input type="number" value={price} onChange={e=>setPrice(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Genre</label>
              <Input value={genre} onChange={e=>setGenre(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Release Date</label>
              <Input type="date" value={releaseDate} onChange={e=>setReleaseDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <Textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">Cover</label>
              <div className="flex items-center gap-3">
                <div className="w-32 h-32 rounded overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                  {cover ? <img src={URL.createObjectURL(cover)} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-500" />}
                </div>
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e)=>{ const f = e.target.files?.[0]||null; if (!f) return; setPendingCover(f); setShowCoverCropper(true); }}
                />
                <Button onClick={()=>coverRef.current?.click()} className="bg-purple-600 hover:bg-purple-700"><Upload className="w-4 h-4 mr-2"/>Select Cover</Button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Audio</label>
              <div className="flex items-center gap-3">
                <div className="w-32 h-20 rounded overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                  {audio ? <Music className="w-8 h-8 text-purple-400" /> : <Music className="w-8 h-8 text-slate-500" />}
                </div>
                <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={(e)=>setAudio(e.target.files?.[0]||null)} />
                <Button onClick={()=>audioRef.current?.click()} className="bg-pink-600 hover:bg-pink-700"><Upload className="w-4 h-4 mr-2"/>Select Audio</Button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2">Preview (optional)</label>
            <div className="flex items-center gap-3">
              <div className="w-32 h-20 rounded overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                {preview ? <Music className="w-8 h-8 text-purple-400" /> : <Music className="w-8 h-8 text-slate-500" />}
              </div>
              <input ref={previewRef} type="file" accept="audio/*" className="hidden" onChange={(e)=>setPreview(e.target.files?.[0]||null)} />
              <Button onClick={()=>previewRef.current?.click()} variant="outline" className="border-slate-700 text-white hover:bg-slate-800"><Upload className="w-4 h-4 mr-2"/>Select Preview</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={submit} disabled={busy} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">{busy? 'Publishing...' : 'Publish Song'}</Button>
      </div>

      <CropperModal
        isOpen={showCoverCropper}
        onClose={()=>{ setShowCoverCropper(false); setPendingCover(null); if (coverRef.current) coverRef.current.value=''; }}
        file={pendingCover}
        aspect={1}
        title="Crop Song Cover"
        description="Adjust the square crop. This is how your song cover will appear."
        onConfirm={async (blob)=>{
          const file = new File([blob], 'song-cover.jpg', { type: 'image/jpeg' });
          setCover(file);
        }}
      />
    </div>
  );
}
