import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function MyAlbums() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user?.id) return;
    setLoading(true);
    fetch(`/api/creators/${user.id}/albums?page=${page}&limit=12`)
      .then(r => r.json())
      .then(d => { setItems(d.items||[]); setPages(d.pages||1); setTotal(d.total||0); })
      .finally(()=>setLoading(false));
  }, [page]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl md:text-3xl font-bold">My Albums ({total})</h1>
        <Button className="bg-purple-600 hover:bg-purple-700" onClick={()=>navigate('/upload/album')}>Add Album</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? Array.from({length:8}).map((_,i)=>(<div key={i} className="h-40 bg-slate-800/40 rounded animate-pulse"/>)) :
         items.map(a => (
           <Card key={a.id} className="bg-slate-900/50 border-purple-900/20">
             <CardContent className="p-3">
               <div className="w-full h-28 rounded bg-slate-800 overflow-hidden mb-2">
                 {a.cover_image ? <img className="w-full h-full object-cover" src={a.cover_image}/> : null}
               </div>
               <div className="text-white font-medium truncate">{a.title}</div>
               <div className="text-xs text-gray-400">GHS {parseFloat(a.price||0).toFixed(2)} · {a.status||'draft'}</div>
               <Button size="sm" variant="outline" className="mt-2 border-slate-700 text-white hover:bg-slate-800" onClick={()=>navigate(`/albums/${a.id}`)}>Open</Button>
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
