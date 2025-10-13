import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/ui/Pagination';
import { useNavigate } from 'react-router-dom';

export default function MySongs() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // advanced filters removed
  const navigate = useNavigate();

  const formatDate = (raw) => {
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (search) params.set('search', search);
    fetch(`/api/creators/${user.id}/songs?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        // only show standalone singles (exclude songs that belong to albums)
        const itemsRaw = d.items || [];
        const onlySingles = Array.isArray(itemsRaw) ? itemsRaw.filter(s => !s.album_id) : [];
        setItems(onlySingles);
        setPages(d.pages||1);
        setTotal(onlySingles.length || d.total || 0);
      })
      .finally(()=>setLoading(false));
  }, [page, search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl md:text-3xl font-bold">My Songs ({total})</h1>
  <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={()=>navigate('/upload/song')}>Add Song</Button>
      </div>
      <div className="bg-slate-900/50 border border-purple-900/20 rounded p-3 mb-4 grid grid-cols-2 md:grid-cols-2 gap-2">
        <input value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} placeholder="Search title" className="col-span-2 md:col-span-2 bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700"/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? Array.from({length:8}).map((_,i)=>(<div key={i} className="h-40 bg-slate-800/40 rounded animate-pulse"/>)) :
         items.map(s => (
           <Card
             key={s.id}
             role="button"
             tabIndex={0}
             onClick={() => navigate(`/songs/${s.id}`)}
             onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/songs/${s.id}`); } }}
             className="bg-slate-900/50 border-purple-900/20 cursor-pointer"
           >
             <CardContent className="p-3">
               <div className="w-full h-28 rounded bg-slate-800 overflow-hidden mb-2">
                 {s.cover_image ? <img className="w-full h-full object-cover" src={s.cover_image}/> : null}
               </div>
               <div className="flex items-center gap-2">
                 <div className="text-white font-medium truncate flex-1">{s.title}</div>
                 <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ${
                   (s.status||'published')==='published' ? 'bg-green-600/20 text-green-400 border border-green-700/30' :
                   (s.status||'published')==='processing' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-700/30' :
                   'bg-slate-600/20 text-slate-300 border border-slate-700/30'
                 }`}>{(s.status||'published')}</span>
               </div>
                {(() => { const rel = formatDate(s.release_date || s.created_at || s.created_date); return rel ? (
                  <div className="text-[11px] text-gray-400 mt-0.5">Released {rel}</div>
                ) : null; })()}
               <div className="text-xs text-gray-400">Min GHS {parseFloat(s.price||0).toFixed(2)}</div>
               <div className="flex gap-2 mt-2">
                 <Button size="sm" variant="outline" className="border-slate-700 text-white hover:bg-slate-800" onClick={(e)=>{ e.stopPropagation(); navigate(`/songs/${s.id}`); }}>Open</Button>
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
