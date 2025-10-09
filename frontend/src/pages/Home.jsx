import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { Sparkles, Search } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useImageViewer } from "@/contexts/ImageViewerContext.jsx";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const { open: openViewer } = useImageViewer();

  useEffect(() => {
    (async () => {
      try { setUser(await User.me()); } catch {}
    })();
  }, []);

  useEffect(() => {
    const h = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      setSearching(true);
      try {
        const res = await fetch(`/api/creators?q=${encodeURIComponent(query)}`);
        const data = res.ok ? await res.json() : [];
        setResults(data);
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(h);
  }, [query]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-hero-radial bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.25),transparent_60%)]" />
  <div className="container relative py-12 md:py-20">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <div className="flex items-center justify-center gap-2 mb-4 text-[15px]">
                <Sparkles className="w-5 h-5 text-accent-yellow" />
                <span className="font-medium text-accent-yellow tracking-wide">Find your favorite creators</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-2 text-white">Discover creators and support them</h1>
              <p className="text-lg text-gray-400">Instantly search for creators and browse their albums and videos.</p>
            </div>
            <div className="mx-auto max-w-xl sticky top-20 z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search creators by name or stage name..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/10 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-gray-400 mt-3 text-sm">Start typing to find creators. Click a creator to view all their content.</p>
            </div>
        </div>
      </section>

  {/* Creator results */}
  <div className="container mt-2 mb-4">
        {query.trim() ? (
          <>
            <h2 className="text-xl text-white mb-4">Creators</h2>
            {searching ? (
              <div className="text-gray-400">Searching…</div>
            ) : results.length === 0 ? (
              <div className="text-gray-400">No creators found</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((c) => (
                  <div key={c.user_id} className="block group">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-purple-900/20 hover:border-purple-500/40 transition">
                      <img
                        src={c.profile_image || 'https://via.placeholder.com/80?text=%F0%9F%8E%B5'}
                        alt={c.display_name}
                        className="w-16 h-16 rounded-full object-cover cursor-zoom-in"
                        onClick={(e) => { e.stopPropagation(); openViewer(c.profile_image); }}
                      />
                        <div className="min-w-0">
                          <Link to={`/creators/${encodeURIComponent(c.user_id)}`} className="block">
                            <div className="text-white font-semibold group-hover:text-purple-300 truncate">{c.display_name}</div>
                            <div className="text-xs text-gray-400">{c.albums_count} albums • {c.videos_count} videos • {c.songs_count} songs</div>
                          </Link>

                          {c.recent_songs && c.recent_songs.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 gap-1">
                              {c.recent_songs.map((s) => (
                                <div key={s.id} className="text-sm text-gray-300 flex justify-between items-center">
                                  <span className="truncate">{s.title}</span>
                                  <span className="text-xs text-yellow-400">GH₵ {parseFloat(s.price)?.toFixed(2) || '0.00'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : user ? (
          <div className="text-gray-400">Search to discover creators. Or browse <Link to={createPageUrl('Songs')} className="text-purple-300 underline">songs</Link> and <Link to={createPageUrl('Videos')} className="text-purple-300 underline">videos</Link>.</div>
        ) : (
          <div className="text-gray-400">Search to discover creators.</div>
        )}
      </div>
    </div>
  );
}