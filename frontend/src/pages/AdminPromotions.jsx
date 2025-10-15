import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminPromotions() {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', url: '', description: '', image: '' });
  const token = user?.token;

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/promotions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setItems(data || []))
      .catch(() => {});
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
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input placeholder="Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
        <textarea placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div>
          <button onClick={save} className="btn btn-primary">Create</button>
        </div>
      </div>

      <div className="grid gap-3">
        {items.map((it) => (
          <div key={it.id} className="p-3 bg-slate-800 rounded flex items-start justify-between">
            <div>
              <div className="font-semibold">{it.title}</div>
              <div className="text-xs text-gray-300">{it.url}</div>
              <div className="text-xs text-gray-400">{it.description}</div>
            </div>
            <div>
              <button onClick={() => remove(it.id)} className="text-red-400">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
