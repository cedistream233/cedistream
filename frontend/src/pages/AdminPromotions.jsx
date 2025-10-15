import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ImagePreviewModal from '@/components/ui/ImagePreviewModal';
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

  

  if (!isAdmin) return <div className="p-4">Access denied</div>;

  return (
    <div className="p-4 max-w-4xl">
      <h2 className="text-lg font-semibold mb-4">Promotions</h2>
      <div className="mb-4 grid grid-cols-1 gap-2">
        {error && <div className="text-sm text-red-300">{error}</div>}
        <input className="p-2 rounded bg-slate-800 border border-slate-700" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
  {formErrors.title && <div className="text-xs text-red-400 mt-1">{formErrors.title}</div>}
        <input className="p-2 rounded bg-slate-800 border border-slate-700" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
  {formErrors.url && <div className="text-xs text-red-400 mt-1">{formErrors.url}</div>}
        <div className="flex gap-2 items-center">
          <input className="p-2 rounded bg-slate-800 border border-slate-700 flex-1" placeholder="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
          <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            // open preview modal; on confirm we'll upload
            setPreviewFile(f);
            setPreviewOpen(true);
            // reset the input value so selecting the same file again will fire change
            e.target.value = '';
          }} />
          <Button size="sm" variant="outline" onClick={() => imageRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</Button>
        </div>
        {form.image && (
          <div className="mt-2">
            <img src={form.image} alt="preview" className="h-20 rounded object-cover border border-slate-700" />
          </div>
        )}
          <ImagePreviewModal
          isOpen={previewOpen}
          onClose={() => { setPreviewOpen(false); /* keep previewFile so user can re-open preview without reselecting */ }}
          file={previewFile}
          imageUrl={null}
          onConfirm={async (file, transformParams) => {
            // upload with progress via XHR
            try {
              setUploading(true);
              setProgressOpen(true);
              setProgressPercent(0);
              setProgressInfo('Preparing…');
              const fd = new FormData();
              fd.append('image', file);
              if (transformParams) {
                fd.append('transform', JSON.stringify(transformParams));
              }
              await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/uploads/promotions-image');
                xhr.setRequestHeader('Authorization', token ? `Bearer ${token}` : '');
                xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    setProgressPercent(pct);
                    setProgressInfo(`${(e.loaded/1024).toFixed(0)} KB uploaded`);
                  }
                };
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                      const j = JSON.parse(xhr.responseText);
                      setForm((s) => ({ ...s, image: j.url, storagePath: j.storagePath || null }));
                      resolve(j.url);
                    } catch (e) { reject(e); }
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
          }}
        />
        <UploadProgressModal open={progressOpen} title="Uploading image" description="Uploading promotion image to storage" percent={progressPercent} info={progressInfo} />
        <textarea className="p-2 rounded bg-slate-800 border border-slate-700" placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {/* promotions are visible to everyone immediately after creation; priority/published removed */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
            <label className="text-sm text-gray-300">Starts</label>
            <input
              type="datetime-local"
              className="p-2 rounded bg-slate-800 border border-slate-700 flex-1 min-w-0"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
            {formErrors.startsAt && <div className="text-xs text-red-400 mt-1">{formErrors.startsAt}</div>}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
            <label className="text-sm text-gray-300">Ends</label>
            <input
              type="datetime-local"
              className="p-2 rounded bg-slate-800 border border-slate-700 flex-1 min-w-0"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
            {formErrors.endsAt && <div className="text-xs text-red-400 mt-1">{formErrors.endsAt}</div>}
          </div>
        </div>
        <div>
          <Button variant="primary" size="sm" onClick={() => {
            // run quick validation before opening confirm
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
        </div>
      </div>

      <div className="grid gap-3">
        {items && items.error === 'forbidden' && (
          <div className="p-3 bg-red-900/10 border border-red-800 text-red-300 rounded">You don't have permission to view promotions. Make sure you're signed in as an admin.</div>
        )}
        {Array.isArray(items) && items.length === 0 && (
          <div className="text-gray-400">No promotions yet. Create one using the form above.</div>
        )}
            {Array.isArray(items) && items.map((it) => (
              <Card key={it.id} className="p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{it.title}</div>
                    <div className="text-xs text-gray-300">{it.url}</div>
                    <div className="text-xs text-gray-400">{it.description}</div>
                    <div className="text-xs text-gray-500 mt-1">Starts: {it.starts_at ? new Date(it.starts_at).toLocaleString() : '—'} • Ends: {it.ends_at ? new Date(it.ends_at).toLocaleString() : '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onDeleteClick(it.id)} className="text-red-400">Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
      </div>
      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={confirmDelete} title="Delete promotion" description="Are you sure you want to delete this promotion? This action cannot be undone." confirmText="Delete" cancelText="Cancel" />
    </div>
  );
}
