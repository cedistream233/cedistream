import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { Sparkles, Search, BarChart3, X, Clock } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useImageViewer } from "@/contexts/ImageViewerContext.jsx";

const RECENT_SEARCHES_KEY = 'cedistream_recent_searches';
const MAX_RECENT_SEARCHES = 5;

// Helper functions for recent searches
const getRecentSearches = () => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveRecentSearch = (searchQuery) => {
  if (!searchQuery || !searchQuery.trim()) return;
  try {
    const trimmed = searchQuery.trim();
    let recent = getRecentSearches();
    // remove if already exists (to move to top)
    recent = recent.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    // add to front
    recent.unshift(trimmed);
    // limit to MAX
    recent = recent.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch {}
};

const removeRecentSearch = (searchQuery) => {
  try {
    let recent = getRecentSearches();
    recent = recent.filter(s => s.toLowerCase() !== searchQuery.toLowerCase());
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch {}
};

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const { open: openViewer } = useImageViewer();

  useEffect(() => {
    (async () => {
      try { setUser(await User.me()); } catch {}
    })();
    // load recent searches on mount
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    const h = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      setSearching(true);
      try {
        const res = await fetch(`/api/creators?q=${encodeURIComponent(query)}`);
        const data = res.ok ? await res.json() : [];
        setResults(data);
        // save to recent searches when results are returned
        if (data.length > 0) {
          saveRecentSearch(query);
          setRecentSearches(getRecentSearches());
        }
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(h);
  }, [query]);

  const handleRecentSearchClick = (searchTerm) => {
    setQuery(searchTerm);
  };

  const handleRemoveRecentSearch = (searchTerm, e) => {
    e.stopPropagation();
    removeRecentSearch(searchTerm);
    setRecentSearches(getRecentSearches());
  };

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
              
              {/* Recently searched chips */}
              {!query.trim() && recentSearches.length > 0 && (
                <div className="mt-3 flex items-start gap-2 flex-wrap">
                  <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    Recent:
                  </div>
                  {recentSearches.map((search, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleRecentSearchClick(search)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRecentSearchClick(search); } }}
                      className="group inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/30 border border-purple-700/30 hover:border-purple-500/50 text-sm text-purple-200 hover:text-purple-100 transition cursor-pointer"
                    >
                      <span className="truncate max-w-[140px]">{search}</span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveRecentSearch(search, e)}
                        className="ml-1 p-1 rounded-full bg-transparent hover:bg-white/5 flex items-center justify-center"
                        aria-label={`Remove ${search} from recent`}
                      >
                        <X className="w-3 h-3 text-purple-200 opacity-100 sm:opacity-0 group-hover:opacity-100 transition" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  <Link key={c.user_id} to={`/creators/${encodeURIComponent(c.username || c.user_id)}`} className="block group">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-purple-900/20 hover:border-purple-500/40 transition cursor-pointer">
                      <img
                        src={c.profile_image || 'https://via.placeholder.com/80?text=%F0%9F%8E%B5'}
                        alt={c.display_name}
                        className="w-16 h-16 rounded-full object-cover cursor-zoom-in"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (c.profile_image) openViewer(c.profile_image); }}
                      />
                      <div className="min-w-0">
                        <div className="text-white font-semibold group-hover:text-purple-300 truncate">{c.display_name}</div>
                        <div className="text-xs text-gray-400">{c.albums_count} albums • {c.videos_count} videos • {c.songs_count} songs</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-gray-400">Search to discover creators.</div>
            {/* Creator Dashboard card removed because a dashboard option already exists in the header/navigation */}
          </div>
        )}
      </div>
    </div>
  );
}