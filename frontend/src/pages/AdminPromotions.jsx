import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CropperModal from '@/components/ui/CropperModal';
import { buildSrcSet } from '@/utils';
import UploadProgressModal from '@/components/ui/UploadProgressModal';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function AdminPromotions() {
  const { user, token, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', url: '', description: '', image: '', storagePath: null, startsAt: '', endsAt: '' });
  const [uploading, setUploading] = useState(false);
  const imageRef = React.useRef();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressInfo, setProgressInfo] = useState('');
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [openConfirm, setOpenConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch('/api/admin/promotions', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 403) {
          console.warn('Admin promotions access forbidden');
          throw new Error('forbidden');
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setItems([]);
          return;
        }
        // Ensure it's an array
        if (Array.isArray(data)) setItems(data);
        else if (data.rows) setItems(data.rows);
        else setItems([]);
      })
      .catch((err) => { 
        console.error('Promotions list fetch error', err); 
        if (String(err.message).toLowerCase().includes('forbidden')) {
          setItems({ error: 'forbidden' });
        } else setItems([]);
      });

    return () => { cancelled = true; };
  }, [isAdmin, token]);

  const save = async () => {
    try {
      // final client-side validation before sending
      const errs = {};
      if (!form.title || String(form.title).trim() === '') errs.title = 'Title is required';
      if (!form.url || String(form.url).trim() === '') errs.url = 'URL is required';
      const s = Date.parse(form.startsAt);
      const e = Date.parse(form.endsAt);
      if (!form.startsAt || String(form.startsAt).trim() === '') errs.startsAt = 'Start date is required';
      if (!form.endsAt || String(form.endsAt).trim() === '') errs.endsAt = 'End date is required';
      if (form.startsAt && Number.isNaN(s)) errs.startsAt = 'Invalid start date';
      if (form.endsAt && Number.isNaN(e)) errs.endsAt = 'Invalid end date';
      if (!Number.isNaN(s) && !Number.isNaN(e) && e <= s) errs.endsAt = 'End must be after start';
      setFormErrors(errs);
      if (Object.keys(errs).length > 0) {
        setError('Please fix the form errors before creating the promotion');
        return;
      }
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      const json = await res.json();
    setItems((s) => [json, ...s]);
    setForm({ title: '', url: '', description: '', image: '', storagePath: null, startsAt: '', endsAt: '' });
    } catch (e) {
      console.error(e);
    }
  };

  const remove = async (id) => {
    try {
      await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setItems((s) => s.filter((it) => it.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const onDeleteClick = (id) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
    setShowDeleteConfirm(false);
  };

  const uploadPromoImage = async (file) => {
    try {
      setUploading(true);
      setProgressOpen(true);
      setProgressPercent(0);
      setProgressInfo('Preparing…');
      const fd = new FormData();
      fd.append('image', file);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/uploads/promotions-image');
        xhr.setRequestHeader('Authorization', token ? `Bearer ${token}` : '');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgressPercent(pct);
            setProgressInfo(`${(e.loaded / 1024).toFixed(0)} KB uploaded`);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const j = JSON.parse(xhr.responseText);
              setForm((s) => ({ ...s, image: j.url, storagePath: j.storagePath || null }));
              resolve(j);
            } catch (err) { reject(err); }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });
    } catch (err) {
      console.error('Image upload error', err);
    } finally {
      setUploading(false);
      setProgressOpen(false);
      setProgressPercent(0);
      setProgressInfo('');
    }
  };

  if (!isAdmin) return <div className="p-4">Access denied</div>;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-slate-900/80 border border-white/10 p-6">
        <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Promotions</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Spotlight what matters</h2>
            <p className="text-sm text-slate-300 mt-1">Feature launches and Adverts for other platforms.</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-slate-200">
            Active promos <span className="text-white font-semibold">{Array.isArray(items) ? items.length : 0}</span>
          </div>
        </div>
      </div>

      <Card className="bg-slate-950/70 border border-white/10 shadow-2xl">
        <CardHeader className="pb-0">
          <CardTitle className="text-white text-xl">Create promotion</CardTitle>
          <p className="text-sm text-slate-400">Upload creative, set dates, then confirm.</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 text-sm px-3 py-2">{error}</div>}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Title</label>
              <input className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none" placeholder="Promo headline" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              {formErrors.title && <div className="text-xs text-red-400 mt-1">{formErrors.title}</div>}
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Destination URL</label>
              <input className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              {formErrors.url && <div className="text-xs text-red-400 mt-1">{formErrors.url}</div>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Artwork</label>
              <div className="flex gap-2">
                <input className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 flex-1 focus:border-purple-500 focus:outline-none" placeholder="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setPendingImage(f);
                  setShowCropper(true);
                  e.target.value = '';
                }} />
                <Button size="sm" variant="outline" onClick={() => imageRef.current?.click()} disabled={uploading} className="border-slate-600 text-white">
                  {uploading ? 'Uploading…' : 'Upload'}
                </Button>
              </div>
              {form.image && (
                <div className="relative mt-3 h-32 rounded-2xl overflow-hidden border border-slate-800">
                  <img
                    src={form.image}
                    alt="preview"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    srcSet={buildSrcSet(form.image) || undefined}
                  />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Starts</label>
                <input type="datetime-local" className="mt-1 w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                {formErrors.startsAt && <div className="text-xs text-red-400 mt-1">{formErrors.startsAt}</div>}
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Ends</label>
                <input type="datetime-local" className="mt-1 w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                {formErrors.endsAt && <div className="text-xs text-red-400 mt-1">{formErrors.endsAt}</div>}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">Description</label>
            <textarea className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 min-h-[96px] focus:border-purple-500 focus:outline-none" placeholder="Short copy that appears next to the banner" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <CropperModal
            isOpen={showCropper}
            onClose={() => { setShowCropper(false); setPendingImage(null); }}
            file={pendingImage}
            aspect={16 / 9}
            title="Crop promotion artwork"
            description="Drag to fit the 16:9 frame shown in the app."
            onConfirm={async (blob) => {
              const cropped = new File([blob], pendingImage?.name || 'promotion.jpg', { type: 'image/jpeg' });
              await uploadPromoImage(cropped);
              setShowCropper(false);
              setPendingImage(null);
            }}
          />
          <UploadProgressModal open={progressOpen} title="Uploading image" description="Uploading promotion image to storage" percent={progressPercent} info={progressInfo} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">You can still review every detail in the confirmation step.</p>
            <Button variant="primary" size="sm" onClick={() => {
              const errs = {};
              if (!form.title || String(form.title).trim() === '') errs.title = 'Title is required';
              if (!form.url || String(form.url).trim() === '') errs.url = 'URL is required';
              const s = Date.parse(form.startsAt);
              const e = Date.parse(form.endsAt);
              if (!form.startsAt || String(form.startsAt).trim() === '') errs.startsAt = 'Start date is required';
              if (!form.endsAt || String(form.endsAt).trim() === '') errs.endsAt = 'End date is required';
              if (form.startsAt && Number.isNaN(s)) errs.startsAt = 'Invalid start date';
              if (form.endsAt && Number.isNaN(e)) errs.endsAt = 'Invalid end date';
              if (!Number.isNaN(s) && !Number.isNaN(e) && e <= s) errs.endsAt = 'End must be after start';
              setFormErrors(errs);
              if (Object.keys(errs).length === 0) {
                setError(null);
                setOpenConfirm(true);
              } else {
                setError('Please fix the form errors before creating the promotion');
              }
            }}>Create</Button>
          </div>

          <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
            <DialogContent className="w-full max-w-3xl">
              <DialogHeader>
                <DialogTitle>Confirm creation</DialogTitle>
                <DialogDescription className="text-gray-400">You're about to create a promotion. Confirm to proceed.</DialogDescription>
              </DialogHeader>
              <CardContent className="py-2">
                <div className="text-sm text-gray-300 mb-2"><strong>{form.title}</strong></div>
                <div className="text-xs text-gray-400">{form.description}</div>
                <div className="text-xs text-gray-400 mt-2">URL: {form.url}</div>
              </CardContent>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setOpenConfirm(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={async () => { setOpenConfirm(false); await save(); }}>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="bg-slate-950/60 border border-white/10">
        <CardHeader className="pb-0">
          <CardTitle className="text-white text-xl">Live & scheduled promotions</CardTitle>
          <p className="text-sm text-slate-400">Manage the banners currently in rotation.</p>
        </CardHeader>
        <CardContent className="pt-6">
          {items && items.error === 'forbidden' ? (
            <div className="p-3 bg-red-900/10 border border-red-800 text-red-300 rounded-lg">You don't have permission to view promotions. Make sure you're signed in as an admin.</div>
          ) : Array.isArray(items) && items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-center text-slate-400">No promotions yet. Create one using the form above.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.isArray(items) && items.map((it) => (
                <Card key={it.id} className="overflow-hidden bg-slate-900/60 border border-slate-800 shadow-lg group">
                  <div className="relative h-40">
                    {it.image ? (
                      <img src={it.image} alt={it.title} className="w-full h-full object-cover" loading="lazy" decoding="async" srcSet={buildSrcSet(it.image) || undefined} />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-purple-900 to-slate-900" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2 text-xs text-white">
                      <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur">LIVE</span>
                      <span className="text-slate-200">{it.starts_at ? new Date(it.starts_at).toLocaleDateString() : '—'} • {it.ends_at ? new Date(it.ends_at).toLocaleDateString() : '—'}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-white font-semibold leading-tight">{it.title}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[220px]">{it.url}</div>
                      </div>
                      <Button variant="outline" size="sm" className="border-red-500/50 text-red-200 hover:bg-red-500/20" onClick={() => onDeleteClick(it.id)}>Delete</Button>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-3">{it.description || 'No description provided.'}</p>
                    <div className="text-[11px] text-slate-500">Created {it.starts_at ? new Date(it.starts_at).toLocaleString() : '—'}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={confirmDelete} title="Delete promotion" description="Are you sure you want to delete this promotion? This action cannot be undone." confirmText="Delete" cancelText="Cancel" />
    </div>
  );
}
