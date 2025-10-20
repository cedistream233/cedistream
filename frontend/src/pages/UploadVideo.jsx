import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import CropperModal from '@/components/ui/CropperModal';
import UploadProgressModal from '@/components/ui/UploadProgressModal';
import PublishSuccessModal from '@/components/ui/PublishSuccessModal';
import ErrorModal from '@/components/ui/ErrorModal';

export default function UploadVideo() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [thumbnail, setThumbnail] = useState(null);
  const [video, setVideo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [created, setCreated] = useState(null);

  const thumbRef = useRef(null);
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const [showThumbCropper, setShowThumbCropper] = useState(false);
  const [pendingThumb, setPendingThumb] = useState(null);

  const submit = async () => {
    setError(''); setSuccess(''); setBusy(true);
    try {
      if (!title || !price || !video) throw new Error('Title, price and video are required');
      const fd = new FormData();
      fd.append('title', title);
      if (description) fd.append('description', description);
      fd.append('price', price);
      if (category) fd.append('category', category);
      if (releaseDate) fd.append('release_date', releaseDate);
      // backend always publishes now
      fd.append('video', video);
      if (thumbnail) fd.append('thumbnail', thumbnail);
  if (preview) fd.append('preview', preview);
      const token = localStorage.getItem('token');
      setProgress(5); setShowProgress(true);
      const start = Date.now(); let lastLoaded = 0; let lastTime = start;
      const res = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/uploads/videos');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.min(99, (e.loaded / e.total) * 100));
            const now = Date.now();
            const deltaBytes = e.loaded - lastLoaded; const deltaTime = (now - lastTime) / 1000;
            if (deltaTime > 0) {
              const speed = deltaBytes / deltaTime;
              const remaining = e.total - e.loaded;
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
  setSuccess('Video published!');
  // ensure PublishSuccessModal recognizes this as a video (so it builds the correct public URL)
  setCreated({ ...data, type: 'video' });
      setShowSuccess(true);
      setTitle(''); setDescription(''); setPrice(''); setCategory(''); setReleaseDate(''); setThumbnail(null); setVideo(null); setPreview(null);
    } catch (e) {
      setError(e.message);
      setShowError(true);
    } finally {
      setBusy(false); setTimeout(()=>setShowProgress(false), 600);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Upload New Video</h1>

      <Card className="bg-slate-900/50 border-purple-900/20 mb-6">
        <CardHeader>
          <CardTitle className="text-white">Video Details</CardTitle>
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
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <Input value={category} onChange={e=>setCategory(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
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
              <label className="block text-xs text-gray-400 mb-2">Thumbnail</label>
              <div className="flex items-center gap-3">
                <div className="w-32 h-20 rounded overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                  {thumbnail ? <img src={URL.createObjectURL(thumbnail)} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-500" />}
                </div>
                <input
                  ref={thumbRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e)=>{
                    const f = e.target.files?.[0]||null;
                    if (!f) return;
                    setPendingThumb(f);
                    setShowThumbCropper(true);
                  }}
                />
                <Button onClick={()=>thumbRef.current?.click()} className="bg-purple-600 hover:bg-purple-700"><Upload className="w-4 h-4 mr-2"/>Select Thumbnail</Button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Video</label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-start">
                    <div className="w-32 h-20 rounded overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                      {video ? <VideoIcon className="w-8 h-8 text-purple-400" /> : <VideoIcon className="w-8 h-8 text-slate-500" />}
                    </div>
                    {video && (
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-700">
                        Added
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e)=>setVideo(e.target.files?.[0]||null)} />
                    <Button onClick={()=>videoRef.current?.click()} className="bg-pink-600 hover:bg-pink-700"><Upload className="w-4 h-4 mr-2"/>Select Video</Button>
                  </div>
                </div>
                {video && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded p-2">
                    <div className="text-sm text-green-400 font-medium truncate">{video.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Size: {(video.size / (1024 * 1024)).toFixed(2)} MB
                      {video.type && ` • Type: ${video.type.split('/')[1]?.toUpperCase() || video.type}`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2">Preview (optional)</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-start">
                  <div className="w-32 h-20 rounded overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                    {preview ? <VideoIcon className="w-8 h-8 text-purple-400" /> : <VideoIcon className="w-8 h-8 text-slate-500" />}
                  </div>
                  {preview && (
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-700">
                      Added
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input ref={previewRef} type="file" accept="video/*" className="hidden" onChange={(e)=>setPreview(e.target.files?.[0]||null)} />
                  <Button onClick={()=>previewRef.current?.click()} variant="outline" className="border-slate-700 text-white hover:bg-slate-800"><Upload className="w-4 h-4 mr-2"/>Select Preview</Button>
                </div>
              </div>
              {preview && (
                <div className="bg-slate-800/50 border border-slate-700 rounded p-2">
                  <div className="text-sm text-green-400 font-medium truncate">{preview.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Size: {(preview.size / (1024 * 1024)).toFixed(2)} MB
                    {preview.type && ` • Type: ${preview.type.split('/')[1]?.toUpperCase() || preview.type}`}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Tip: keep previews short (e.g. 15–30 seconds) to optimize load time.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={()=>submit()} disabled={busy} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">{busy? 'Publishing...' : 'Publish Video'}</Button>
      </div>

      <CropperModal
        isOpen={showThumbCropper}
        onClose={()=>{ setShowThumbCropper(false); setPendingThumb(null); if (thumbRef.current) thumbRef.current.value=''; }}
        file={pendingThumb}
        aspect={16/9}
        title="Crop Video Thumbnail"
        description="Adjust the crop to 16:9. This is how your thumbnail will appear."
        onConfirm={async (blob)=>{
          const file = new File([blob], 'video-thumb.jpg', { type: 'image/jpeg' });
          setThumbnail(file);
        }}
      />

  <UploadProgressModal open={showProgress} title="Uploading Video" description="Your video is uploading. This may take a while depending on size and network." percent={progress} info={eta||'Preparing…'} />
      
      <PublishSuccessModal
        open={showSuccess}
        title="Video Published!"
        message="Your video is live. Share it or manage it in My Content."
        compact={true}
        created={created}
        onManage={() => { setShowSuccess(false); window.location.href = '/dashboard?tab=content'; }}
        onView={() => { setShowSuccess(false); if (created?.id) window.location.href = `/videos/${encodeURIComponent(created.id)}`; }}
        onShare={() => { if (navigator.share && created?.id) navigator.share({ title: created?.title || 'New video', url: `${window.location.origin}/videos/${created.id}` }).catch(()=>{}); else if (created?.id) navigator.clipboard.writeText(`${window.location.origin}/videos/${created.id}`); }}
        onUploadAnother={() => { setShowSuccess(false); window.location.href = '/upload/video'; }}
        onClose={() => setShowSuccess(false)}
      />

      <ErrorModal
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Upload Failed"
        error={error}
        description="Upload failed — check the error details below and try again. If the issue persists, contact support."
        actionText="Try Again"
        onAction={() => {
          // Just close the modal - user can fix issues and resubmit
        }}
      />
    </div>
  );
}
