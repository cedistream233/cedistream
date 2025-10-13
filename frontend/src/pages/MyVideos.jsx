import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/ui/Pagination';
import { useNavigate } from 'react-router-dom';

export default function MyVideos() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  // advanced filters removed
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user?.id) return;
    const LIMIT = 12;
    const key = JSON.stringify({ uid: user.id, page, limit: LIMIT, search: search || '' });

    const cached = cacheRef.current.get(key);
    if (cached) {
      setItems(cached.items);
      setPages(cached.pages);
      setTotal(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) params.set('search', search);
    fetch(`/api/creators/${user.id}/videos?${params.toString()}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
      .then(d => {
        const itemsArr = Array.isArray(d.items) ? d.items : [];
        const next = { items: itemsArr, pages: d.pages || 1, total: d.total || itemsArr.length || 0 };
        cacheRef.current.set(key, next);
        setItems(next.items);
        setPages(next.pages);
        setTotal(next.total);
      })
      .catch(e => { if (e.name !== 'AbortError') console.error(e); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    // Prefetch next page
    const nextPage = page + 1;
    const nextKey = JSON.stringify({ uid: user.id, page: nextPage, limit: LIMIT, search: search || '' });
    if (!cacheRef.current.get(nextKey)) {
      const nextParams = new URLSearchParams({ page: String(nextPage), limit: String(LIMIT) });
      if (search) nextParams.set('search', search);
      fetch(`/api/creators/${user.id}/videos?${nextParams.toString()}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          const itemsArr = Array.isArray(d.items) ? d.items : [];
          cacheRef.current.set(nextKey, { items: itemsArr, pages: d.pages || 1, total: d.total || itemsArr.length || 0 });
        })
        .catch(() => {});
    }

    return () => { controller.abort(); };
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
               <div className="flex items-center gap-2">
                 <div className="text-white font-medium truncate flex-1">{v.title}</div>
                 <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ${
                   (v.status||'published')==='published' ? 'bg-green-600/20 text-green-400 border border-green-700/30' :
                   (v.status||'published')==='processing' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-700/30' :
                   'bg-slate-600/20 text-slate-300 border border-slate-700/30'
                 }`}>{(v.status||'published')}</span>
               </div>
               <div className="text-xs text-gray-400">Min GHS {parseFloat(v.price||0).toFixed(2)}</div>
               <div className="flex gap-2 mt-2">
                 <Button size="sm" variant="outline" className="border-slate-700 text-white hover:bg-slate-800" onClick={()=>navigate(`/videos/${v.id}`)}>Open</Button>
                 {/* publish toggle removed */}
               </div>
             </CardContent>
           </Card>
         ))}
      </div>
      <div className="mt-6">
        <Pagination
          page={page}
          pages={pages}
          limit={12}
          onChange={(p) => setPage(Math.max(1, Math.min(p, pages||1)))}
        />
      </div>
    </div>
  );
}
