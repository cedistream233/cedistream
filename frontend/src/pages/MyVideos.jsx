import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/ui/Pagination';
import { useNavigate } from 'react-router-dom';
import ContentCard from '@/components/content/ContentCard';

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
      {/* Responsive list: grid of compact rows on small screens; on desktop show YouTube-style vertical list (thumbnail left, details right) */}
      <div className="sm:hidden flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 bg-slate-800/40 rounded animate-pulse" />
          ))
        ) : (
          items.map((v) => (
            <ContentCard
              key={v.id}
              item={{
                ...v,
                cover_image: v.thumbnail,
                artist: v.creator || v.uploader,
                release_date: v.published_at || v.created_at,
                owned_by_me: v.owned_by_me,
              }}
              type="video"
              mobileRow={true}
              onViewDetails={() => navigate(`/videos/${v.id}`)}
              showPwyw={false}
            />
          ))
        )}
      </div>

      {/* Desktop grid: YouTube channel-style thumbnails */}
      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-full bg-slate-800/40 rounded animate-pulse" style={{ paddingTop: '56.25%' }} />
          ))
        ) : (
          items.map((v) => (
            <Card key={`grid-${v.id}`} className="bg-slate-900/50 border-purple-900/20 cursor-pointer" onClick={() => navigate(`/videos/${v.id}`)}>
              <CardContent className="p-0">
                <div className="w-full relative rounded overflow-hidden" style={{ paddingTop: '56.25%' }}>
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                      <Play className="w-10 h-10 text-purple-200" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">{v.title}</h3>
                  <div className="text-xs text-gray-400">{v.creator || v.uploader}</div>
                  {v.published_at && <div className="text-xs text-gray-500 mt-1">{new Date(v.published_at).toLocaleDateString()}</div>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
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
