import React, { useState, useEffect } from 'react';
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
  const [salesPageSize, setSalesPageSize] = useState(10);
  const [salesHasMore, setSalesHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
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

  // hydrate basic user info and trigger an initial fetch without needing a manual refresh
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    // fire an initial fetch using token from localStorage if available
    fetchDashboardData();
  }, []);

  // Fetch dashboard data whenever auth token becomes available/changes
  useEffect(() => {
    if (!token) return; // wait until token is ready so creator-protected routes succeed
    fetchDashboardData();
    // re-fetch when pagination changes so recent sales update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, salesPage, salesPageSize]);

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
    try {
      const tokenLocal = token || localStorage.getItem('token');
      
      // Fetch user profile with creator data
      const profileResponse = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${tokenLocal}`
        }
      });
      
      let authedId = null;
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setUser(profileData);
        authedId = profileData?.id;
        
        // We'll rely on /api/creators/:id for authoritative counts & totals
      }

      // Get creator totals (earnings, sales, albums, videos)
      if (authedId) {
        const cMetaRes = await fetch(`/api/creators/${authedId}`);
        if (cMetaRes.ok) {
          const meta = await cMetaRes.json();
          setStats(prev => ({
            ...prev,
            totalEarnings: parseFloat(meta.total_earnings || 0),
            totalSales: parseInt(meta.total_sales || 0, 10),
            albumCount: parseInt(meta.albums_count || 0, 10),
            songsCount: parseInt(meta.songs_count || 0, 10),
            videoCount: parseInt(meta.videos_count || 0, 10)
          }));
        }
      }

      // Load my content (albums/videos for this creator)
      if (authedId || user?.id) {
        try {
          setContentLoading(true);
          const idToUse = authedId || user?.id;
          if (idToUse) {
            const cRes = await fetch(`/api/creators/${idToUse}/content`);
            if (cRes.ok) {
              const cData = await cRes.json();
              // ensure songs only counts standalone songs (not tracks that belong to albums)
              const allSongs = cData.songs || [];
              const standaloneSongs = Array.isArray(allSongs) ? allSongs.filter(s => !s.album_id) : [];
              setMyContent({ albums: cData.albums || [], videos: cData.videos || [], songs: allSongs });
              setStats(prev => ({ ...prev, songsCount: standaloneSongs.length }));
            }
          }
        } catch {}
        finally { setContentLoading(false); }
      }

      // Always ensure songsCount is accurate by querying songs endpoint and counting standalone singles
      try {
        const idToUse2 = authedId || user?.id;
        if (idToUse2) {
          const songsList = await Song.list({ user_id: idToUse2 });
          const onlySingles = Array.isArray(songsList) ? songsList.filter(s => !s.album_id) : [];
          setStats(prev => ({ ...prev, songsCount: onlySingles.length }));
        }
      } catch (e) {
        // ignore
      }

      // Recent sales for this creator (paginated)
      try {
        const offset = (salesPage - 1) * salesPageSize;
        const salesRes = await fetch(`/api/uploads/recent-sales?limit=${salesPageSize}&offset=${offset}`, {
          headers: { 'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : '' }
        });
        if (salesRes.ok) {
          const rows = await salesRes.json();
          setRecentSales(Array.isArray(rows) ? rows.map(r => ({
            id: r.id,
            item: r.item,
            type: r.item_type,
            amount: parseFloat(r.amount || 0), // gross
            creatorAmount: typeof r.creator_amount !== 'undefined' ? parseFloat(r.creator_amount || 0) : null, // net if backend provides
            date: r.date ? new Date(r.date).toISOString().slice(0,10) : '',
            buyer: r.buyer_name || '—'
          })) : []);
          setSalesHasMore(Array.isArray(rows) ? rows.length === salesPageSize : false);
        } else {
          setRecentSales([]);
          setSalesHasMore(false);
        }
      } catch (e) {
        setRecentSales([]);
        setSalesHasMore(false);
      }

      // No hardcoded values; keep monthly/views at 0 unless we have analytics sources
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load withdrawal summary (available balance)
  useEffect(() => {
    (async () => {
      try {
        const tokenLocal = token || localStorage.getItem('token');
        const res = await fetch('/api/withdrawals/me/summary', { headers: { Authorization: tokenLocal ? `Bearer ${tokenLocal}` : '' } });
        if (res.ok) {
          const json = await res.json();
          setWithdrawSummary(json);
        }
      } catch {}
    })();
  }, [token]);

  // Share/copy helpers
  const creatorPublicUrl = (() => {
    const id = user?.id || '';
    const base = window?.location?.origin || '';
    return id ? `${base}/creators/${encodeURIComponent(id)}` : '';
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
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">{title}</p>
              <p className="text-2xl font-bold text-white mt-1">{value}</p>
              {change && (
                <p className="text-green-400 text-sm mt-1 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {change}
                </p>
              )}
            </div>
            <div className={`p-3 rounded-full bg-slate-800 ${color}`}>
              <Icon className="w-6 h-6" />
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
            <p className="text-gray-400">Here's what's happening with your content</p>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        <Tabs defaultValue="overview" className="space-y-6">
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
                    <div className="space-y-4">
                      {recentSales.map((sale) => (
                        <div key={sale.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-purple-600/20 rounded-lg">
                              {sale.type === 'album' ? (
                                <Music2 className="w-4 h-4 text-purple-400" />
                              ) : sale.type === 'song' ? (
                                <Music className="w-4 h-4 text-yellow-400" />
                              ) : (
                                <Video className="w-4 h-4 text-pink-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium break-words">{sale.item}</p>
                              <p className="text-gray-400 text-sm">{sale.buyer} • {sale.date}</p>
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-0 text-right">
                            <div className="text-green-400 font-bold">GH₵ {(sale.creatorAmount !== null ? sale.creatorAmount : (sale.amount * 0.8)).toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2">
                            <button className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={() => setSalesPage(p => Math.max(1, p-1))} disabled={salesPage === 1}>Prev</button>
                            <button className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700" onClick={() => { if (salesHasMore) setSalesPage(p => p+1); }} disabled={!salesHasMore}>Next</button>
                            <span className="text-sm text-gray-400">Page {salesPage}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-400">Per page</label>
                            <select value={salesPageSize} onChange={e => { setSalesPageSize(parseInt(e.target.value,10)); setSalesPage(1); }} className="bg-slate-800 text-white px-2 py-1 rounded">
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                              <option value={25}>25</option>
                            </select>
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
                    <p className="text-3xl font-bold text-green-400 mt-2">GH₵ {stats.totalEarnings.toFixed(2)}</p>
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
                    <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/40 p-4">
                      <p className="text-slate-400 text-sm">No withdrawals yet.</p>
                      <p className="text-slate-500 text-xs mt-1">Your approved withdrawals will appear here.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
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
                  setWithdrawOpen(false);
                  setWithdrawAmount(''); setMomo(''); setMomo2('');
                  alert('Withdrawal request submitted. You will receive funds within 24 hours.');
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