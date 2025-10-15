import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminPromotions() {
  const { user, token, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', url: '', description: '', image: '', priority: 0, published: true, startsAt: '', endsAt: '' });
  const [error, setError] = useState(null);

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
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      const json = await res.json();
      setItems((s) => [json, ...s]);
      setForm({ title: '', url: '', description: '', image: '' });
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

  if (!isAdmin) return <div className="p-4">Access denied</div>;

  return (
    <div className="p-4 max-w-4xl">
      <h2 className="text-lg font-semibold mb-4">Promotions</h2>
      <div className="mb-4 grid grid-cols-1 gap-2">
        {error && <div className="text-sm text-red-300">{error}</div>}
        <input className="p-2 rounded bg-slate-800 border border-slate-700" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="p-2 rounded bg-slate-800 border border-slate-700" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input className="p-2 rounded bg-slate-800 border border-slate-700" placeholder="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
        <textarea className="p-2 rounded bg-slate-800 border border-slate-700" placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-300">Priority</label>
          <input type="number" className="w-24 p-2 rounded bg-slate-800 border border-slate-700" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value || 0) })} />
          <label className="ml-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Published</label>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-300">Starts</label>
          <input type="datetime-local" className="p-2 rounded bg-slate-800 border border-slate-700" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          <label className="text-sm text-gray-300">Ends</label>
          <input type="datetime-local" className="p-2 rounded bg-slate-800 border border-slate-700" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        </div>
        <div>
          <button onClick={save} className="btn btn-primary px-3 py-1">Create</button>
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
              <div key={it.id} className="p-3 bg-slate-800 rounded flex items-start justify-between">
                <div>
                  <div className="font-semibold">{it.title} <span className="text-xs text-gray-400 ml-2">{it.published ? '• Published' : '• Draft'}</span></div>
                  <div className="text-xs text-gray-300">{it.url}</div>
                  <div className="text-xs text-gray-400">{it.description}</div>
                  <div className="text-xs text-gray-500 mt-1">Priority: {it.priority || 0} • Starts: {it.starts_at ? new Date(it.starts_at).toLocaleString() : '—'} • Ends: {it.ends_at ? new Date(it.ends_at).toLocaleString() : '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => remove(it.id)} className="text-red-400 text-sm px-2 py-1 border border-red-600 rounded">Delete</button>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
