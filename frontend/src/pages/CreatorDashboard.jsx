import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Music2, 
  Music,
  Video, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Eye,
  Download,
  Calendar,
  PieChart,
  ChevronRight,
  Share2,
  Copy
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Edit2, X } from 'lucide-react';
// ...existing code...
import Insights from '@/components/insights/Insights';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useImageViewer } from '@/contexts/ImageViewerContext';
import { useNavigate } from 'react-router-dom';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import Pagination from '@/components/ui/Pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Song } from '@/entities/Song';

export default function CreatorDashboard() {
  const [tab, setTab] = useState('overview');
  const [user, setUser] = useState(null);
  const { token, updateUser } = useAuth();
  const navigate = useNavigate();
  const { open: openViewer } = useImageViewer();
  const [showRemoveConfirm, setShowRemoveConfirm] = React.useState(false);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    totalSales: 0,
    albumCount: 0,
    songsCount: 0,
    videoCount: 0,
    monthlyEarnings: 0,
    viewsThisMonth: 0
  });
  const [recentSales, setRecentSales] = useState([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(5);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesHasMore, setSalesHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const recentCache = useRef(new Map());
  const recentAbort = useRef(null);
  const [myContent, setMyContent] = useState({ albums: [], videos: [] });
  // include songs list
  const [songsLoading, setSongsLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [momo, setMomo] = useState('');
  const [momo2, setMomo2] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawSummary, setWithdrawSummary] = useState({ available: 0, minWithdrawal: 10, transferFee: 1.0, currency: 'GHS' });
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [successModal, setSuccessModal] = useState({ open: false, message: '' });
  
  // Guard to prevent concurrent/duplicate fetchDashboardData calls (avoid 429 rate limit)
  const fetchingDashboard = useRef(false);
  const lastFetchTime = useRef(0);

  // hydrate basic user info and trigger an initial fetch without needing a manual refresh
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    try {
      // honor ?tab= query param so uploads can deep-link to My Content
      const qp = new URLSearchParams(window.location.search);
      const initialTab = qp.get('tab');
      if (initialTab) setTab(initialTab);
    } catch (e) {}
    // fire an initial fetch using token from localStorage if available
    fetchDashboardData();
  }, []);

  // Fetch dashboard data whenever auth token becomes available/changes
  useEffect(() => {
    if (!token) return; // wait until token is ready so creator-protected routes succeed
    fetchDashboardData();
    // only re-run the full dashboard when token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Recent sales fetch (separate from full dashboard to avoid re-fetching everything on page change)
  // Extracted fetch for recent sales so it can be called on-demand (tab switches)
  const fetchRecentSales = async () => {
    if (!token) return;
    const key = JSON.stringify({ page: salesPage, size: salesPageSize });

    // serve from cache immediately if present
    const cached = recentCache.current.get(key);
    if (cached) {
      setRecentSales(cached.items);
      setSalesTotal(cached.total);
      setSalesHasMore(cached.hasMore);
    }

    // cancel previous request
    if (recentAbort.current) recentAbort.current.abort();
    const controller = new AbortController();
    recentAbort.current = controller;

    try {
      const offset = (salesPage - 1) * salesPageSize;
      const salesRes = await fetch(`/api/uploads/recent-sales?limit=${salesPageSize}&offset=${offset}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        signal: controller.signal
      });
      if (salesRes.ok) {
        const data = await salesRes.json();
        const rows = Array.isArray(data?.items) ? data.items : [];
        const items = rows.map(r => ({
          id: r.id,
          item: r.item,
          type: r.item_type,
          amount: parseFloat(r.amount || 0), // gross
          creatorAmount: typeof r.creator_amount !== 'undefined' ? parseFloat(r.creator_amount || 0) : null, // net if backend provides
          date: r.date ? new Date(r.date).toISOString().slice(0,10) : '',
          buyer: r.buyer_name || '—'
        }));
        const total = typeof data?.total === 'number' ? data.total : rows.length;
        const hasMore = rows.length === salesPageSize && rows.length > 0;
        recentCache.current.set(key, { items, total, hasMore });
        setRecentSales(items);
        setSalesTotal(total);
        setSalesHasMore(hasMore);
      } else {
        setRecentSales([]);
        setSalesHasMore(false);
        setSalesTotal(0);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Recent sales fetch failed', e);
        setRecentSales([]);
        setSalesHasMore(false);
        setSalesTotal(0);
      }
    }

    // Prefetch next page (best-effort)
    try {
      const nextPage = salesPage + 1;
      const nextKey = JSON.stringify({ page: nextPage, size: salesPageSize });
      if (!recentCache.current.get(nextKey)) {
        const nextOffset = (nextPage - 1) * salesPageSize;
        const r = await fetch(`/api/uploads/recent-sales?limit=${salesPageSize}&offset=${nextOffset}`, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
        if (r && r.ok) {
          const d = await r.json();
          const rows2 = Array.isArray(d?.items) ? d.items : [];
          const items2 = rows2.map(rw => ({
            id: rw.id,
            item: rw.item,
            type: rw.item_type,
            amount: parseFloat(rw.amount || 0),
            creatorAmount: typeof rw.creator_amount !== 'undefined' ? parseFloat(rw.creator_amount || 0) : null,
            date: rw.date ? new Date(rw.date).toISOString().slice(0,10) : '',
            buyer: rw.buyer_name || '—'
          }));
          recentCache.current.set(nextKey, { items: items2, total: typeof d?.total === 'number' ? d.total : rows2.length, hasMore: rows2.length === salesPageSize });
        }
      }
    } catch {}
  };

  // Keep recent sales in sync when page/size change or when tab becomes overview/earnings
  useEffect(() => {
    if (!token) return;
    if (tab === 'overview' || tab === 'earnings') fetchRecentSales().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, salesPage, salesPageSize, tab]);

  // Refresh when tab gains focus or page becomes visible
  useEffect(() => {
    const onFocus = () => fetchDashboardData();
    const onVis = () => { if (document.visibilityState === 'visible') fetchDashboardData(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const fetchDashboardData = async () => {
    // Deduplicate: skip if already fetching or if fetched within last 2 seconds
    const now = Date.now();
    if (fetchingDashboard.current || (now - lastFetchTime.current < 2000)) {
      return;
    }
    fetchingDashboard.current = true;
    lastFetchTime.current = now;

    try {
      const tokenLocal = token || localStorage.getItem('token');
      
      // Fetch user profile first to get authedId
      const profileResponse = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${tokenLocal}` }
      });
      
      let authedId = null;
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setUser(profileData);
        authedId = profileData?.id;
      }

      if (!authedId) {
        setLoading(false);
        fetchingDashboard.current = false;
        return;
      }

      // Parallelize all remaining fetches to reduce load time from ~7s to ~1-2s
      const [metaRes, contentRes, salesRes] = await Promise.allSettled([
        fetch(`/api/creators/${authedId}`),
        fetch(`/api/creators/${authedId}/content`),
        fetch(`/api/uploads/recent-sales?limit=${salesPageSize}&offset=${(salesPage - 1) * salesPageSize}`, {
          headers: { 'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : '' }
        })
      ]);

      // Process creator metadata
      if (metaRes.status === 'fulfilled' && metaRes.value.ok) {
        const meta = await metaRes.value.json();
        setStats(prev => ({
          ...prev,
          totalEarnings: parseFloat(meta.total_earnings || 0),
          totalSales: parseInt(meta.total_sales || 0, 10),
          albumCount: parseInt(meta.albums_count || 0, 10),
          songsCount: parseInt(meta.songs_count || 0, 10),
          videoCount: parseInt(meta.videos_count || 0, 10)
        }));
      }

      // Process content
      if (contentRes.status === 'fulfilled' && contentRes.value.ok) {
        const cData = await contentRes.value.json();
        const allSongs = cData.songs || [];
        const standaloneSongs = Array.isArray(allSongs) ? allSongs.filter(s => !s.album_id) : [];
        setMyContent({ albums: cData.albums || [], videos: cData.videos || [], songs: allSongs });
        setStats(prev => ({ ...prev, songsCount: standaloneSongs.length }));
        setContentLoading(false);
      } else {
        setContentLoading(false);
      }

      // Process sales
      if (salesRes.status === 'fulfilled' && salesRes.value.ok) {
        const data = await salesRes.value.json();
        const rows = Array.isArray(data?.items) ? data.items : [];
        setRecentSales(rows.map(r => ({
          id: r.id,
          item: r.item,
          type: r.item_type,
          amount: parseFloat(r.amount || 0),
          creatorAmount: typeof r.creator_amount !== 'undefined' ? parseFloat(r.creator_amount || 0) : null,
          date: r.date ? new Date(r.date).toISOString().slice(0,10) : '',
          buyer: r.buyer_name || '—'
        })));
        setSalesTotal(typeof data?.total === 'number' ? data.total : rows.length);
        setSalesHasMore(rows.length === salesPageSize && rows.length > 0);
      } else {
        setRecentSales([]);
        setSalesHasMore(false);
        setSalesTotal(0);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      fetchingDashboard.current = false;
    }
  };

  // Load withdrawal summary (available balance)
  const loadWithdrawSummary = async () => {
    try {
      const tokenLocal = token || localStorage.getItem('token');
      const res = await fetch('/api/withdrawals/me/summary', { headers: { Authorization: tokenLocal ? `Bearer ${tokenLocal}` : '' } });
      if (res.ok) {
        const json = await res.json();
        setWithdrawSummary(json);
      }
    } catch {}
  };

  useEffect(() => { loadWithdrawSummary(); }, [token]);

  // Load withdrawal history
  const loadWithdrawHistory = async () => {
    try {
      const tokenLocal = token || localStorage.getItem('token');
      const res = await fetch('/api/withdrawals/me', { headers: { Authorization: tokenLocal ? `Bearer ${tokenLocal}` : '' } });
      if (res.ok) {
        const json = await res.json();
        setWithdrawHistory(Array.isArray(json) ? json : []);
      }
    } catch (e) { }
  };

  useEffect(() => { loadWithdrawHistory(); }, [token]);

  // Share/copy helpers
  const creatorPublicUrl = (() => {
    const base = window?.location?.origin || '';
    const handle = (user?.username && String(user.username).trim()) ? user.username : (user?.id || '');
    return handle ? `${base}/creators/${encodeURIComponent(handle)}` : '';
  })();

  const handleShareProfile = async () => {
    try {
      if (navigator.share && creatorPublicUrl) {
        await navigator.share({ title: user?.creatorProfile?.stage_name || 'My Creator Profile', url: creatorPublicUrl, text: 'Check out my profile on CediStream' });
        return;
      }
    } catch {}
    // fallback: copy
    await handleCopyProfile();
  };

  const handleCopyProfile = async () => {
    try {
      if (!creatorPublicUrl) return;
      await navigator.clipboard.writeText(creatorPublicUrl);
      // quick UI feedback
      const el = document.getElementById('share-link-feedback');
      if (el) {
        el.textContent = 'Link copied!';
        setTimeout(() => { el.textContent = ''; }, 1600);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleRemoveImage = async () => {
    try {
      const res = await fetch('/api/auth/profile/image', {
        method: 'DELETE',
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove image');
      // refresh profile data
      setUser(data.user);
      updateUser?.(data.user);
    } catch (err) {
      console.error('Remove image error:', err);
    } finally {
      setShowRemoveConfirm(false);
    }
  };

  // Export recent sales as CSV (client-side)
  const downloadSalesCsv = () => {
    (async () => {
      try {
        // Fetch full sales list (limit=0 for all)
        const tokenLocal = token || localStorage.getItem('token');
        // Request server to stream CSV back
        const res = await fetch('/api/uploads/sales-export?limit=0', { headers: { Authorization: tokenLocal ? `Bearer ${tokenLocal}` : '' } });
        if (!res.ok) throw new Error('Failed to download CSV');
        const blob = await res.blob();

        const date = new Date().toISOString().slice(0,10);
        const defaultName = `cedistream-sales-${date}.csv`;

        // Prefer Save File Picker (Chromium browsers) to let user choose location
        const w = window;
        if (w && 'showSaveFilePicker' in w) {
          try {
            const handle = await w.showSaveFilePicker({
              suggestedName: defaultName,
              types: [
                {
                  description: 'CSV Files',
                  accept: { 'text/csv': ['.csv'] }
                }
              ]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return; // done
          } catch (pickerErr) {
            // If user cancels or API not allowed, fall back to anchor method
          }
        }

        // Fallback: create object URL and trigger a download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('CSV export failed', e);
      }
    })();
  };

  if (loading) return <LoadingOverlay text="Loading dashboard" />;

  const StatCard = ({ icon: Icon, title, value, change, color = "text-purple-400" }) => (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm font-medium">{title}</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1">{value}</p>
              {change && (
                <p className="text-green-400 text-xs sm:text-sm mt-1 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {change}
                </p>
              )}
            </div>
            <div className={`p-2 sm:p-3 rounded-full bg-slate-800 ${color}`}>
              <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Avatar */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
       <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-800 border-4 border-white/5 flex items-center justify-center text-2xl font-bold text-white cursor-pointer"
         onClick={() => { if (user?.profile_image) openViewer(user.profile_image); }}>
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (() => {
                      const first = user?.first_name || user?.firstName || '';
                      const last = user?.last_name || user?.lastName || '';
                      if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
                      const base = user?.username || user?.email || 'U';
                      return String(base[0]).toUpperCase();
                    })()
                  )}
                </div>

                {/* overlay controls for small screens only (stacked) */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-3 md:hidden">
                  <button onClick={() => setShowRemoveConfirm(true)} type="button" className="bg-white rounded-full p-2 shadow-md text-red-500 border border-slate-200" aria-label="Remove photo">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={()=>navigate('/profile')} type="button" className="bg-white rounded-full p-2 shadow-md text-blue-500 border border-slate-200" aria-label="Edit photo">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Desktop controls: visible on md+ screens, placed next to avatar */}
              <div className="hidden md:flex flex-col ml-4 gap-2">
                <button onClick={()=>navigate('/profile')} type="button" className="flex items-center gap-2 px-3 py-1 rounded-md bg-white text-blue-600 hover:bg-slate-100 shadow" aria-label="Edit photo desktop">
                  <Edit2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Edit Photo</span>
                </button>
                <button onClick={() => setShowRemoveConfirm(true)} type="button" className="flex items-center gap-2 px-3 py-1 rounded-md bg-white text-red-600 hover:bg-slate-100 shadow" aria-label="Remove photo desktop">
                  <X className="w-4 h-4" />
                  <span className="text-sm font-medium">Remove Photo</span>
                </button>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {(() => {
                const first = user?.first_name || user?.firstName;
                const last = user?.last_name || user?.lastName;
                const full = first && last ? `${first} ${last}` : (first || last);
                const fallback = user?.username || user?.email || 'there';
                const display = user?.creatorProfile?.stage_name || full || fallback;
                return `Welcome back, ${display}!`;
              })()}
            </h1>           
            <p className="text-sm text-gray-400 mt-2">NOTE: Amounts shown under Earnings are your net share after the platform’s fee 20%.</p>

            {/* Shareable Profile Link */}
            {creatorPublicUrl && (
              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-slate-900/60 border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-gray-300 overflow-hidden">
                  <span className="truncate block">{creatorPublicUrl}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleShareProfile} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button onClick={handleCopyProfile} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-white border border-slate-700 hover:bg-slate-700">
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                </div>
                <div id="share-link-feedback" className="text-xs text-green-300 min-w-[80px]"></div>
              </div>
            )}
            {/* Withdraw button removed from header — moved to Earnings card for creators */}
          </motion.div>
        </div>

        {/* Stats Grid - always visible, values sourced from backend */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <StatCard
            icon={DollarSign}
            title="Total Earnings"
            value={`GH₵ ${stats.totalEarnings.toFixed(2)}`}
            color="text-green-400"
          />
          <StatCard
            icon={Users}
            title="Total Sales"
            value={stats.totalSales}
            color="text-blue-400"
          />
          <StatCard
            icon={Music2}
            title="Albums"
            value={stats.albumCount}
            color="text-purple-400"
          />
          <StatCard
            icon={Music}
            title="Songs"
            value={stats.songsCount}
            color="text-yellow-400"
          />
          <StatCard
            icon={Video}
            title="Videos"
            value={stats.videoCount}
            color="text-pink-400"
          />
        </div>

        {/* Main Content */}
        <Tabs value={tab} onValueChange={(v) => { setTab(v);
            // prefetch data when switching tabs
            if (v === 'overview') fetchRecentSales().catch(()=>{});
            if (v === 'content') { /* ensure content lists are ready */ setContentLoading(true); setTimeout(()=>setContentLoading(false), 0); }
            if (v === 'earnings') { fetchRecentSales().catch(()=>{}); loadWithdrawSummary(); }
          }} defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-900/50 border-purple-900/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600">Overview</TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-purple-600">My Content</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-purple-600">Analytics</TabsTrigger>
            <TabsTrigger value="earnings" className="data-[state=active]:bg-purple-600">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Recent Activity - always visible with empty state */}
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Recent Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentSales.length === 0 ? (
                    <div className="flex items-center justify-center h-28 rounded-md border border-dashed border-slate-700 bg-slate-900/40">
                      <p className="text-slate-400 text-sm">No sales yet. Your latest sales will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {recentSales.map((sale) => (
                        <div key={sale.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 bg-slate-800/50 rounded-md sm:rounded-lg">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="p-1.5 sm:p-2 bg-purple-600/20 rounded-md">
                              {sale.type === 'album' ? (
                                <Music2 className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                              ) : sale.type === 'song' ? (
                                <Music className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
                              ) : (
                                <Video className="w-3 h-3 sm:w-4 sm:h-4 text-pink-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium break-words text-sm sm:text-base">{sale.item}</p>
                              <p className="text-gray-400 text-xs sm:text-sm">{sale.buyer} • {sale.date}</p>
                            </div>
                          </div>
                          <div className="mt-1 sm:mt-0 text-right">
                            <div className="text-green-400 font-bold text-sm sm:text-base">GH₵ {(sale.creatorAmount !== null ? sale.creatorAmount : (sale.amount * 0.8)).toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                        <div className="mt-4 flex flex-col items-center gap-2">
                          <div className="w-full max-w-xs">
                            <Pagination
                              page={salesPage}
                              limit={salesPageSize}
                              total={typeof salesTotal === 'number' ? salesTotal : undefined}
                              onChange={(p) => setSalesPage(Math.max(1, p))}
                              showLabel={false}
                            />
                          </div>
                          <div className="text-xs text-gray-300">
                            {(() => {
                              const total = Number.isFinite(salesTotal) ? salesTotal : 0;
                              if (total === 0) return 'Showing 0 of 0';
                              const start = (salesPage - 1) * salesPageSize + 1;
                              const end = Math.min(total, salesPage * salesPageSize);
                              return `Showing ${start}-${end} of ${total}`;
                            })()}
                          </div>
                        </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Export Report button removed per request */}
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">My Content</h2>
            </div>
            {contentLoading ? (
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardContent className="p-6 text-gray-400">Loading your content…</CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                {[{
                  label: `Albums (${stats.albumCount})`,
                  icon: Music2,
                  desc: 'View and manage all your albums',
                  href: '/my/albums'
                },{
                  label: `Songs (${stats.songsCount})`,
                  icon: Music,
                  desc: 'View and manage all your songs',
                  href: '/my/songs'
                },{
                  label: `Videos (${stats.videoCount})`,
                  icon: Video,
                  desc: 'View and manage all your videos',
                  href: '/my/videos'
                }].map((t, i) => (
                  <Card key={i} onClick={()=>navigate(t.href)} className="group bg-slate-900/50 border-purple-900/20 backdrop-blur-sm cursor-pointer hover:bg-slate-900/70 transition">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <t.icon className="w-5 h-5 text-purple-400" /> {t.label}
                        <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition ml-auto" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-400 text-sm">{t.desc}</p>
                      <p className="text-xs text-slate-500 mt-2">Tap to view all</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Analytics</h2>
            <Insights creatorId={user?.id} token={token} />
          </TabsContent>

          <TabsContent value="earnings" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Earnings</h2>
              <Button variant="outline" className="border-slate-700 text-white hover:bg-slate-800" onClick={downloadSalesCsv}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Available Balance</p>
                    {/* Short note immediately above the total earnings amount */}
                    <p className="text-xs text-gray-400 mt-1">Shown net of platform fee — you receive 80%</p>
                    <p className="text-3xl font-bold text-green-400 mt-2">GH₵ {Number(withdrawSummary?.available || 0).toFixed(2)}</p>
                    <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 w-full" onClick={() => setWithdrawOpen(true)}>
                      Withdraw Funds
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm md:col-span-2">
                <CardContent className="p-6">
                  <div>
                    <p className="text-gray-300 text-sm font-medium">Withdrawal History</p>
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-gray-400">Note: Amounts shown include a GH₵1 transfer fee; the "amount to be received" reflects this fee.</p>
                      {withdrawHistory.length === 0 ? (
                        <div className="rounded-md border border-slate-800 bg-slate-900/40 p-4">
                          <p className="text-slate-400 text-sm">No withdrawals yet.</p>
                          <p className="text-slate-500 text-xs mt-1">Your approved withdrawals will appear here.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {withdrawHistory.map(w => (
                            <div key={w.id} className={`p-3 rounded-md border ${w.status === 'requested' ? 'border-yellow-600 bg-yellow-900/5' : w.status === 'paid' ? 'border-green-600 bg-green-900/5' : 'border-red-600 bg-red-900/5'}`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm text-white font-semibold">GH₵ {Number(w.amount).toFixed(2)}</div>
                                  <div className="text-xs text-gray-400">{w.destination_type === 'mobile_money' ? 'Mobile Money' : w.destination_type}: {w.destination_account}</div>
                                  <div className="text-xs text-gray-500 mt-1">Requested: {new Date(w.created_at).toLocaleString()}</div>
                                </div>
                                <div className="text-sm font-semibold">
                                  {w.status === 'requested' && <span className="px-2 py-1 rounded-md bg-yellow-600 text-black">Pending</span>}
                                  {w.status === 'processing' && <span className="px-2 py-1 rounded-md bg-indigo-600 text-white">Processing</span>}
                                  {w.status === 'paid' && <span className="px-2 py-1 rounded-md bg-green-600 text-white">Approved</span>}
                                  {w.status === 'rejected' && <span className="px-2 py-1 rounded-md bg-red-600 text-white">Declined</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      {/* Success modal after request */}
      <Dialog open={successModal.open} onOpenChange={() => setSuccessModal({ open: false, message: '' })}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-sm">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-semibold">Request Submitted</DialogTitle>
            <DialogDescription className="text-gray-400">{successModal.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessModal({ open: false, message: '' })} className="bg-emerald-600 hover:bg-emerald-700 text-white">OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      <ConfirmModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveImage}
        title="Remove profile photo"
        description="Are you sure you want to remove your profile photo? This action can be undone by uploading a new photo later."
        confirmText="Remove"
        cancelText="Cancel"
      />
        {/* Withdraw modal mount */}
        <Dialog open={withdrawOpen} onOpenChange={() => { setWithdrawOpen(false); setWithdrawAmount(''); setMomo(''); setMomo2(''); }}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl font-semibold">Withdraw Funds</DialogTitle>
              {/* Provide an accessible description to satisfy Radix a11y checks */}
              <DialogDescription className="sr-only">Enter withdrawal amount and mobile money details, then submit.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div>
                <label className="text-sm text-gray-300">Amount ({withdrawSummary?.currency || 'GHS'})</label>
                <input type="number" min={Number(withdrawSummary?.minWithdrawal || 10)} value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} placeholder={`Minimum ${withdrawSummary?.currency || 'GHS'} ${Number(withdrawSummary?.minWithdrawal || 10).toFixed(2)}`} className="w-full border rounded px-3 py-2 bg-slate-800 text-white" />
                {withdrawAmount !== '' && Number(withdrawAmount) < Number(withdrawSummary?.minWithdrawal || 10) && (
                  <p className="text-xs text-red-400 mt-1">Amount must be at least {withdrawSummary?.currency || 'GHS'} {Number(withdrawSummary?.minWithdrawal || 10).toFixed(2)}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-300">Mobile Money Number</label>
                <input type="tel" value={momo} onChange={e=>setMomo(String(e.target.value).replace(/\D/g,'').slice(0,10))} placeholder="e.g. 0241234567" maxLength={10} className="w-full border rounded px-3 py-2 bg-slate-800 text-white" />
                <p className="text-xs text-gray-500 mt-1">Must be a 10-digit Ghana number starting with 020, 024, 054, etc.</p>
              </div>
              <div>
                <label className="text-sm text-gray-300">Confirm Mobile Money Number</label>
                <input type="tel" value={momo2} onChange={e=>setMomo2(String(e.target.value).replace(/\D/g,'').slice(0,10))} placeholder="Re-enter number" maxLength={10} className="w-full border rounded px-3 py-2 bg-slate-800 text-white" />
                {momo2 !== '' && momo !== momo2 && (
                  <p className="text-xs text-red-400 mt-1">Mobile money numbers do not match.</p>
                )}
              </div>

              <div className="bg-slate-800 rounded p-3 text-sm text-gray-300">
                <div className="flex justify-between"><span>Estimated transfer fee</span><span>{withdrawSummary?.currency || 'GHS'} {Number(withdrawSummary?.transferFee || 1).toFixed(2)}</span></div>
                <div className="flex justify-between mt-1"><span>Estimated amount to be received</span><span>{withdrawSummary?.currency || 'GHS'} {Math.max(0, +(Math.max(Number(withdrawSummary?.minWithdrawal || 10), Number(withdrawAmount || 0)) - Number(withdrawSummary?.transferFee || 1)).toFixed(2))}</span></div>
                <p className="text-xs text-gray-500 mt-2">Withdrawals can take up to 24 hours to process after you request them.</p>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0 mt-4">
              <Button variant="secondary" onClick={() => { setWithdrawOpen(false); setWithdrawAmount(''); setMomo(''); setMomo2(''); }} className="border-slate-600 hover:bg-slate-800">Cancel</Button>
              <Button onClick={async () => {
                try {
                  setWithdrawing(true);
                  const tokenLocal = token || localStorage.getItem('token');
                  const res = await fetch('/api/withdrawals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: tokenLocal ? `Bearer ${tokenLocal}` : '' },
                    body: JSON.stringify({ amount: Number(withdrawAmount), momoNumber: momo, momoConfirm: momo2 })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed to submit withdrawal');
                  // Refresh summary
                  const sumRes = await fetch('/api/withdrawals/me/summary', { headers: { Authorization: tokenLocal ? `Bearer ${tokenLocal}` : '' } });
                  if (sumRes.ok) setWithdrawSummary(await sumRes.json());
                  // Append the new request to local history as pending (server returned record)
                  if (data && data.request) {
                    setWithdrawHistory(prev => [data.request, ...prev]);
                    // locally deduct available amount so UI updates immediately
                    setWithdrawSummary(prev => ({ ...prev, available: Math.max(0, Number(prev.available || 0) - Number(data.request.amount || 0)) }));
                  }
                  setWithdrawOpen(false);
                  setWithdrawAmount(''); setMomo(''); setMomo2('');
                  setSuccessModal({ open: true, message: 'Withdrawal request submitted. You will receive funds within 24 hours.' });
                } catch (e) {
                  alert(e.message || 'Withdrawal failed');
                } finally {
                  setWithdrawing(false);
                }
              }} className={`bg-emerald-600 hover:bg-emerald-700 text-white ${withdrawing ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={withdrawing || Number(withdrawAmount || 0) < Number(withdrawSummary?.minWithdrawal || 10) || !momo || momo !== momo2 || String(momo).replace(/\D/g,'').length !== 10}>
                {withdrawing ? 'Submitting...' : 'Request Withdraw'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

// Modal for Withdraw
function WithdrawModal({ open, onClose, summary, submitting, onSubmit, amount, setAmount, momo, setMomo, momo2, setMomo2 }) {
  if (!open) return null;
  const min = Number(summary?.minWithdrawal || 10);
  const fee = Number(summary?.transferFee || 1);
  const available = Number(summary?.available || 0);
  const amt = Math.max(min, Number(amount || 0) || 0);
  const toReceive = Math.max(0, +(amt - fee).toFixed(2));
  const disabled = submitting || amt < min || amt > available || !momo || momo !== momo2 || String(momo).replace(/\D/g,'').length !== 10;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-xl font-semibold mb-2">Withdraw Funds</h3>
        <p className="text-sm text-gray-500 mb-4">Available: {summary?.currency || 'GHS'} {available.toFixed(2)}</p>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-700">Amount ({summary?.currency || 'GHS'})</label>
            <input type="number" min={min} value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`Minimum ${summary?.currency || 'GHS'} ${min.toFixed(2)}`} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-sm text-gray-700">Mobile Money Number</label>
            <input type="tel" value={momo} onChange={e=>setMomo(String(e.target.value).replace(/\D/g,'').slice(0,10))} placeholder="e.g. 0241234567" maxLength={10} className="w-full border rounded px-3 py-2" />
            <p className="text-xs text-gray-500 mt-1">Must be a 10-digit Ghana number starting with 020, 024, 054, etc.</p>
          </div>
          <div>
            <label className="text-sm text-gray-700">Confirm Mobile Money Number</label>
            <input type="tel" value={momo2} onChange={e=>setMomo2(String(e.target.value).replace(/\D/g,'').slice(0,10))} placeholder="Re-enter number" maxLength={10} className="w-full border rounded px-3 py-2" />
            {momo2 !== '' && momo !== momo2 && (
              <p className="text-xs text-red-400 mt-1">Mobile money numbers do not match.</p>
            )}
          </div>
          <div className="bg-slate-100 rounded p-3 text-sm">
            <div className="flex justify-between"><span>Estimated transfer fee</span><span>{summary?.currency || 'GHS'} {fee.toFixed(2)}</span></div>
            <div className="flex justify-between mt-1"><span>Estimated amount to be received</span><span>{summary?.currency || 'GHS'} {toReceive.toFixed(2)}</span></div>
            <p className="text-xs text-gray-500 mt-2">Note: Withdrawals can take up to 24 hours to process after you request them. Please allow up to one business day for the funds to arrive.</p>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
            <button disabled={disabled} onClick={onSubmit} className={`px-4 py-2 rounded text-white ${disabled ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{submitting ? 'Submitting...' : 'Confirm Withdraw'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}