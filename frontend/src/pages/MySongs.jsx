import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function MySongs() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    fetch(`/api/creators/${user.id}/songs?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setItems(d.items||[]); setPages(d.pages||1); setTotal(d.total||0); })
      .finally(()=>setLoading(false));
  }, [page, search, status, from, to, minPrice, maxPrice]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl md:text-3xl font-bold">My Songs ({total})</h1>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={()=>navigate('/upload/album')}>Add Song</Button>
      </div>
      <div className="bg-slate-900/50 border border-purple-900/20 rounded p-3 mb-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <input value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} placeholder="Search title" className="col-span-2 md:col-span-2 bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700"/>
        <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}} className="bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <input type="date" value={from} onChange={e=>{setPage(1);setFrom(e.target.value);}} className="bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700"/>
        <input type="date" value={to} onChange={e=>{setPage(1);setTo(e.target.value);}} className="bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700"/>
        <input type="number" min="0" value={minPrice} onChange={e=>{setPage(1);setMinPrice(e.target.value);}} placeholder="Min price" className="bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700"/>
        <input type="number" min="0" value={maxPrice} onChange={e=>{setPage(1);setMaxPrice(e.target.value);}} placeholder="Max price" className="bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700"/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? Array.from({length:8}).map((_,i)=>(<div key={i} className="h-40 bg-slate-800/40 rounded animate-pulse"/>)) :
         items.map(s => (
           <Card key={s.id} className="bg-slate-900/50 border-purple-900/20">
             <CardContent className="p-3">
               <div className="w-full h-28 rounded bg-slate-800 overflow-hidden mb-2">
                 {s.cover_image ? <img className="w-full h-full object-cover" src={s.cover_image}/> : null}
               </div>
               <div className="text-white font-medium truncate">{s.title}</div>
               <div className="text-xs text-gray-400">GHS {parseFloat(s.price||0).toFixed(2)} · {s.status||'draft'}</div>
               <div className="flex gap-2 mt-2">
                 <Button size="sm" variant="outline" className="border-slate-700 text-white hover:bg-slate-800" onClick={()=>navigate(`/songs/${s.id}`)}>Open</Button>
                 <Button size="sm" variant="outline" className="border-slate-700 text-white hover:bg-slate-800" onClick={async()=>{
                   const token = localStorage.getItem('token');
                   const next = s.status === 'published' ? 'draft' : 'published';
                   const res = await fetch(`/api/uploads/songs/${s.id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json', Authorization: token?`Bearer ${token}`:''}, body: JSON.stringify({status: next})});
                   if (res.ok) {
                     const updated = await res.json();
                     setItems(list=>list.map(x=>x.id===s.id?updated:x));
                   }
                 }}>{s.status === 'published' ? 'Unpublish' : 'Publish'}</Button>
               </div>
             </CardContent>
           </Card>
         ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-6">
        <Button disabled={page<=1} onClick={()=>setPage(p=>p-1)} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">Prev</Button>
        <span className="text-gray-300 text-sm">Page {page} of {pages}</span>
        <Button disabled={page>=pages} onClick={()=>setPage(p=>p+1)} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">Next</Button>
      </div>
    </div>
  );
}
