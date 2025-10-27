import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ContentCard from '@/components/content/ContentCard';
import Pagination from '@/components/ui/Pagination';
import { useNavigate } from 'react-router-dom';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

export default function MySongs() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // raw search (updates instantly as user types)
  const [search, setSearch] = useState('');
  // debouncedSearch is what we actually use to fetch (updated after a short delay)
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const cacheRef = useRef(new Map()); // key -> { items, pages, total }
  const abortRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const navigate = useNavigate();

  const formatDate = (raw) => {
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Debounce effect: wait 250ms after the user stops typing to update debouncedSearch
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [search]);

  // Data fetching effect: depends on page and debouncedSearch (not raw search)
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user?.id) return;
    const LIMIT = 12;
    const key = JSON.stringify({ uid: user.id, page, limit: LIMIT, search: debouncedSearch || '' });

    // If cached, show instantly
    const cached = cacheRef.current.get(key);
    if (cached) {
      setItems(cached.items);
      setPages(cached.pages);
      setTotal(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Cancel in-flight
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchData = async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
        if (debouncedSearch) params.set('search', debouncedSearch);

        const res = await fetch(`/api/creators/${user.id}/songs?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load');

        const d = await res.json();
        const itemsRaw = d.items || [];
        const onlySingles = Array.isArray(itemsRaw) ? itemsRaw.filter(s => !s.album_id) : [];
        const next = { items: onlySingles, pages: d.pages || 1, total: (onlySingles.length || d.total || 0) };
        cacheRef.current.set(key, next);
        setItems(next.items);
        setPages(next.pages);
        setTotal(next.total);
      } catch (e) {
        if (e.name !== 'AbortError') console.error('Error fetching songs:', e);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchData();

    // Prefetch next page optimistically
    const nextPage = page + 1;
    const nextKey = JSON.stringify({ uid: user.id, page: nextPage, limit: LIMIT, search: debouncedSearch || '' });
    if (!cacheRef.current.get(nextKey)) {
      const nextParams = new URLSearchParams({ page: String(nextPage), limit: String(LIMIT) });
      if (debouncedSearch) nextParams.set('search', debouncedSearch);
      fetch(`/api/creators/${user.id}/songs?${nextParams.toString()}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d) return;
          const itemsRaw = d.items || [];
          const onlySingles = Array.isArray(itemsRaw) ? itemsRaw.filter(s => !s.album_id) : [];
          cacheRef.current.set(nextKey, { items: onlySingles, pages: d.pages || 1, total: (onlySingles.length || d.total || 0) });
        })
        .catch(() => { /* swallow prefetch errors */ });
    }

    return () => { controller.abort(); };
  }, [page, debouncedSearch]);

  // Show a full-page overlay only on initial loads (when we have no items yet)
  if (loading && items.length === 0) {
    return <LoadingOverlay text="Loading songs" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-2xl md:text-3xl font-bold">My Songs ({total})</h1>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/upload/song')}>Add Song</Button>
      </div>

      <div className="bg-slate-900/50 border border-purple-900/20 rounded p-3 mb-4 grid grid-cols-2 md:grid-cols-2 gap-2">
        <input
          value={search}
          onChange={e => { setPage(1); setSearch(e.target.value); }} // immediate UI update; fetch waits for debounce
          placeholder="Search title"
          className="col-span-2 md:col-span-2 bg-slate-800 text-white text-sm rounded px-3 py-2 outline-none border border-slate-700"
        />
      </div>

      <div>
        {/* Mobile: compact rows */}
        <div className="block sm:hidden flex flex-col gap-3">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-800/40 rounded animate-pulse" />
            ))
          ) : (
            items.map(s => (
              <ContentCard
                key={s.id}
                item={{ ...s, cover_image: s.cover_image || s.thumbnail, release_date: s.release_date || s.created_at }}
                type="song"
                mobileRow={true}
                onViewDetails={() => navigate(`/songs/${s.id}`)}
                showPwyw={true}
              />
            ))
          )}
        </div>

        {/* Desktop/Tablet: row-style list (matches supporters' layout) */}
        <div className="hidden sm:flex flex-col gap-3">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-800/40 rounded animate-pulse" />
            ))
          ) : (
            items.map(s => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/songs/${s.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/songs/${s.id}`); } }}
                className="group flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-purple-900/20 hover:bg-slate-900/70 transition cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-14 h-14 rounded-md overflow-hidden shrink-0">
                    {s.cover_image ? (
                      <img src={s.cover_image} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">{s.title}</div>
                      {s.artist || s.creator ? <div className="text-xs text-gray-400 truncate">{s.artist || s.creator}</div> : null}
                      {(() => {
                        const d = s.published_at || s.release_date || s.created_at || s.created_date || null;
                        if (!d) return null;
                        try {
                          const formatted = new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                          return <div className="text-xs text-gray-400 mt-0.5">Published {formatted}</div>;
                        } catch (e) { return null; }
                      })()}
                  </div>
                </div>
                <div className="pl-3 flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/songs/${encodeURIComponent(s.id)}`); }} className="px-3 py-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:from-purple-700 hover:to-pink-700">Open</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6">
        <Pagination
          page={page}
          pages={pages}
          limit={12}
          onChange={(p) => setPage(Math.max(1, Math.min(p, pages || 1)))}
        />
      </div>
    </div>
  );
}
