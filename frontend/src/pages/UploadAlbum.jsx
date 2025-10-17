import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, MoveVertical, Upload, Music, Image as ImageIcon } from 'lucide-react';
import CropperModal from '@/components/ui/CropperModal';
import UploadProgressModal from '@/components/ui/UploadProgressModal';
import PublishSuccessModal from '@/components/ui/PublishSuccessModal';

export default function UploadAlbum() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [genre, setGenre] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [cover, setCover] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [created, setCreated] = useState(null);
  const coverInputRef = useRef(null);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  const [pendingCover, setPendingCover] = useState(null);

  // Tracks for albums do not collect per-track price or duration; album price covers access
  const addTrack = () => setTracks(t => [...t, { id: crypto.randomUUID(), title: '', audio: null, preview: null }]);
  const removeTrack = (id) => setTracks(t => t.filter(x => x.id !== id));
  const moveTrack = (id, dir) => setTracks(t => {
    const idx = t.findIndex(x => x.id === id);
    if (idx < 0) return t;
    const next = [...t];
    const swapIdx = dir === 'up' ? Math.max(0, idx - 1) : Math.min(t.length - 1, idx + 1);
    const [item] = next.splice(idx, 1);
    next.splice(swapIdx, 0, item);
    return next;
  });

  const onPublish = async () => handleSubmit();

  const handleSubmit = async () => {
    setError(''); setSuccess(''); setPublishing(true);
    try {
      if (!title || !price) throw new Error('Title and price are required');
      const fd = new FormData();
      fd.append('title', title);
      if (description) fd.append('description', description);
      fd.append('price', price);
      if (genre) fd.append('genre', genre);
      if (releaseDate) fd.append('release_date', releaseDate);
      // backend always publishes now; no drafts or scheduling
      if (cover) fd.append('cover', cover);
      // for albums, individual tracks inherit album access; send price as 0 for each track
      const songs = tracks.map((t, i) => ({
        title: t.title,
        price: 0,
        audio: `audio_${t.id}`,
        preview: t.preview ? `preview_${t.id}` : undefined,
        track_number: i + 1,
      }));
      fd.append('songs', JSON.stringify(songs));
      for (const t of tracks) {
        if (t.audio) fd.append(`audio_${t.id}`, t.audio);
        if (t.preview) fd.append(`preview_${t.id}`, t.preview);
      }
      const token = localStorage.getItem('token');
      setProgress(5); setShowProgress(true);
      const start = Date.now(); let lastLoaded = 0; let lastTime = start;
      const res = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/uploads/albums');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = (e.loaded / e.total) * 100; setProgress(Math.min(99, pct));
            const now = Date.now();
            const deltaBytes = e.loaded - lastLoaded; const deltaTime = (now - lastTime)/1000;
            if (deltaTime > 0) {
              const speed = deltaBytes / deltaTime; const remaining = e.total - e.loaded;
              const seconds = speed > 0 ? Math.ceil(remaining / speed) : 0;
              if (isFinite(seconds)) setEta(seconds > 0 ? `~${seconds}s remaining` : 'Almost done…');
            }
            lastLoaded = e.loaded; lastTime = now;
          }
        };
        xhr.onreadystatechange = () => { if (xhr.readyState === 4) resolve(xhr); };
        xhr.onerror = reject;
        xhr.send(fd);
      });
      const data = JSON.parse(res.responseText || '{}');
      if (res.status < 200 || res.status >= 300) throw new Error(data.error || 'Upload failed');
      setProgress(100);
      setSuccess('Album published!');
      setCreated(data?.album || null);
      setShowSuccess(true);
      setTitle(''); setDescription(''); setPrice(''); setGenre(''); setReleaseDate(''); setCover(null); setTracks([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false); setTimeout(()=>setShowProgress(false), 600);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Upload New Album</h1>
      {error && <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-600 rounded p-2">{error}</div>}
      {success && <div className="mb-4 text-sm text-green-300 bg-green-500/10 border border-green-600 rounded p-2">{success}</div>}

      <Card className="bg-slate-900/50 border-purple-900/20 mb-6">
        <CardHeader>
          <CardTitle className="text-white">Album Details</CardTitle>
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
          <div>
            <label className="block text-xs text-gray-400 mb-2">Album Cover</label>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 rounded-md overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                {cover ? (
                  <img src={URL.createObjectURL(cover)} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-slate-500" />
                )}
              </div>
              <div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e)=>{
                    const f = e.target.files?.[0] || null;
                    if (!f) return;
                    setPendingCover(f);
                    setShowCoverCropper(true);
                  }}
                />
                <Button onClick={()=>coverInputRef.current?.click()} className="bg-purple-600 hover:bg-purple-700"><Upload className="w-4 h-4 mr-2"/>Select Cover</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-purple-900/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>Tracks</span>
            <Button onClick={addTrack} size="sm" className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4 mr-1"/>Add Track</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tracks.length === 0 && (
            <div className="text-sm text-gray-400">No tracks yet. Add your first track.</div>
          )}
          {tracks.map((t, idx) => (
            <div key={t.id} className="p-4 rounded-lg border border-purple-900/20 bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-gray-300 font-medium flex items-center gap-2"><MoveVertical className="w-4 h-4"/> Track {idx+1}</div>
                <Button variant="outline" onClick={()=>removeTrack(t.id)} className="border-slate-700 text-red-300 hover:bg-slate-800" size="sm"><Trash2 className="w-4 h-4 mr-1"/>Remove</Button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Title</label>
                  <Input value={t.title} onChange={e=>setTracks(x=>x.map(s=>s.id===t.id?{...s,title:e.target.value}:s))} className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FilePicker label="Audio File" accept="audio/*" value={t.audio} onChange={(file)=>setTracks(x=>x.map(s=>s.id===t.id?{...s,audio:file}:s))} />
                <FilePicker label="Preview (optional)" accept="audio/*" value={t.preview} onChange={(file)=>setTracks(x=>x.map(s=>s.id===t.id?{...s,preview:file}:s))} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={()=>moveTrack(t.id,'up')} className="border-slate-700 text-white hover:bg-slate-800">Move Up</Button>
                <Button size="sm" variant="outline" onClick={()=>moveTrack(t.id,'down')} className="border-slate-700 text-white hover:bg-slate-800">Move Down</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3">
        <Button onClick={onPublish} disabled={publishing} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">{publishing? 'Publishing...' : 'Publish Album'}</Button>
      </div>

      {/* Cover cropper */}
      <CropperModal
        isOpen={showCoverCropper}
        onClose={()=>{ setShowCoverCropper(false); setPendingCover(null); if (coverInputRef.current) coverInputRef.current.value=''; }}
        file={pendingCover}
        aspect={1}
        title="Crop Album Cover"
        description="Adjust the square crop. This is how your album cover will appear."
        onConfirm={async (blob)=>{
          const file = new File([blob], 'album-cover.jpg', { type: 'image/jpeg' });
          setCover(file);
        }}
      />
  <UploadProgressModal open={showProgress} title="Uploading Album" description="Uploading your album and tracks. Please keep this page open until complete." percent={progress} info={eta || 'Preparing…'} />
      <PublishSuccessModal
        open={showSuccess}
        title="Album Published!"
        message="Your album is live. Share it or manage it in My Content."
        created={created}
        onManage={() => { setShowSuccess(false); window.location.href = '/dashboard?tab=content'; }}
        onView={() => { setShowSuccess(false); if (created?.id) window.location.href = `/albums/${encodeURIComponent(created.id)}`; }}
        onShare={() => { if (navigator.share && created?.id) navigator.share({ title: created?.title || 'New album', url: `${window.location.origin}/albums/${created.id}` }).catch(()=>{}); else if (created?.id) navigator.clipboard.writeText(`${window.location.origin}/albums/${created.id}`); }}
        onUploadAnother={() => { setShowSuccess(false); window.location.href = '/upload/album'; }}
        onClose={() => setShowSuccess(false)}
      />
    </div>
  );
}

function FilePicker({ label, accept, value, onChange }) {
  const ref = useRef(null);
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <Input readOnly value={value?.name || ''} placeholder={`Select ${label.toLowerCase()}`} className="bg-slate-800 border-slate-700 text-white" />
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e)=>onChange(e.target.files?.[0]||null)} />
        <Button type="button" onClick={()=>ref.current?.click()} className="bg-purple-600 hover:bg-purple-700"><Upload className="w-4 h-4 mr-1"/>Choose</Button>
        {value && (
          <div className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-700">
            Added
          </div>
        )}
      </div>
    </div>
  );
}
