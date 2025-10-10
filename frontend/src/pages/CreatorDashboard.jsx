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
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Edit2, X } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useImageViewer } from '@/contexts/ImageViewerContext';
import { useNavigate } from 'react-router-dom';

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
  const [loading, setLoading] = useState(true);
  const [myContent, setMyContent] = useState({ albums: [], videos: [] });
  // include songs list
  const [songsLoading, setSongsLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
              setMyContent({ albums: cData.albums || [], videos: cData.videos || [], songs: cData.songs || [] });
            }
          }
        } catch {}
        finally { setContentLoading(false); }
      }

      // Recent sales for this creator
      const salesRes = await fetch('/api/uploads/recent-sales', {
        headers: { 'Authorization': tokenLocal ? `Bearer ${tokenLocal}` : '' }
      });
      if (salesRes.ok) {
        const rows = await salesRes.json();
        setRecentSales(Array.isArray(rows) ? rows.map(r => ({
          id: r.id,
          item: r.item,
          type: r.item_type,
          amount: parseFloat(r.amount || 0),
          date: new Date(r.date).toISOString().slice(0,10),
          buyer: '—'
        })) : []);
      } else {
        setRecentSales([]);
      }

      // No hardcoded values; keep monthly/views at 0 unless we have analytics sources
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
    try {
      const headers = ['Date','Type','Item','Amount'];
      const rows = recentSales.map(s => [s.date, s.type, s.item, s.amount.toFixed(2)]);
      const csv = [headers, ...rows]
        .map(r => r.map(v => {
          const val = String(v ?? '');
          return /[",\n]/.test(val) ? '"' + val.replace(/"/g,'""') + '"' : val;
        }).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0,10);
      a.download = `cedistream-sales-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSV export failed', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

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
                          <div className="text-green-400 font-bold mt-2 sm:mt-0">+GH₵ {sale.amount.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Export Report - same look as Earnings section */}
              <div className="flex">
                <Button onClick={downloadSalesCsv} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    Views This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{stats.viewsThisMonth.toLocaleString()}</div>
                  <p className="text-green-400 text-sm mt-1">+15% from last month</p>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    Monthly Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">GH₵ {stats.monthlyEarnings.toFixed(2)}</div>
                  <p className="text-green-400 text-sm mt-1">+8% from last month</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="earnings" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Earnings</h2>
              <Button variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
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
                    <Button className="mt-4 bg-green-600 hover:bg-green-700 w-full">
                      Request Payout
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">This Month</p>
                    <p className="text-3xl font-bold text-white mt-2">GH₵ {stats.monthlyEarnings.toFixed(2)}</p>
                    <p className="text-green-400 text-sm mt-2">+12% vs last month</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">Pending Payouts</p>
                    <p className="text-3xl font-bold text-yellow-400 mt-2">GH₵ 0.00</p>
                    <p className="text-gray-400 text-sm mt-2">No pending payouts</p>
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
    </div>
  );
}