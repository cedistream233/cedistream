import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function MyVideos() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // advanced filters removed
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (search) params.set('search', search);
    fetch(`/api/creators/${user.id}/videos?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setItems(d.items||[]); setPages(d.pages||1); setTotal(d.total||0); })
      .finally(()=>setLoading(false));
  }, [page, search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl md:text-3xl font-bold">My Videos ({total})</h1>
        <Button className="bg-pink-600 hover:bg-pink-700" onClick={()=>navigate('/upload/video')}>Add Video</Button>
      </div>
      <div className="bg-slate-900/50 border border-purple-900/20 rounded p-3 mb-4 grid grid-cols-2 md:grid-cols-2 gap-2">
        <input value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} placeholder="Search title" className="col-span-2 md:col-span-2 bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700"/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? Array.from({length:8}).map((_,i)=>(<div key={i} className="h-40 bg-slate-800/40 rounded animate-pulse"/>)) :
         items.map(v => (
           <Card key={v.id} className="bg-slate-900/50 border-purple-900/20">
             <CardContent className="p-3">
               <div className="w-full h-28 rounded bg-slate-800 overflow-hidden mb-2">
                 {v.thumbnail ? <img className="w-full h-full object-cover" src={v.thumbnail}/> : null}
               </div>
               <div className="text-white font-medium truncate">{v.title}</div>
               <div className="text-xs text-gray-400">Min GHS {parseFloat(v.price||0).toFixed(2)}</div>
               <div className="flex gap-2 mt-2">
                 <Button size="sm" variant="outline" className="border-slate-700 text-white hover:bg-slate-800" onClick={()=>navigate(`/videos/${v.id}`)}>Open</Button>
                 {/* publish toggle removed */}
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
