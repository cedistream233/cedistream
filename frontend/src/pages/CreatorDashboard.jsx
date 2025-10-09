import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Music2, 
  Video, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Eye,
  Plus,
  Download,
  Calendar,
  PieChart,
  BarChart3
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
    videoCount: 0,
    monthlyEarnings: 0,
    viewsThisMonth: 0
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch user profile with creator data
      const profileResponse = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setUser(profileData);
        
        if (profileData.creatorProfile) {
          setStats(prevStats => ({
            ...prevStats,
            totalEarnings: parseFloat(profileData.creatorProfile.total_earnings || 0),
            totalSales: profileData.creatorProfile.total_sales || 0
          }));
        }
      }

      // You can add more API calls here for albums, videos, recent sales etc.
      // For now, we'll use mock data
      setStats(prevStats => ({
        ...prevStats,
        albumCount: 3,
        videoCount: 2,
        monthlyEarnings: 450.00,
        viewsThisMonth: 1250
      }));

      setRecentSales([
        { id: 1, item: 'Afro Vibes', type: 'album', amount: 25.00, date: '2024-10-08', buyer: 'John D.' },
        { id: 2, item: 'Behind the Music', type: 'video', amount: 15.00, date: '2024-10-07', buyer: 'Sarah M.' },
        { id: 3, item: 'Afro Vibes', type: 'album', amount: 25.00, date: '2024-10-06', buyer: 'Mike K.' }
      ]);
      
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={DollarSign}
            title="Total Earnings"
            value={`GH₵ ${stats.totalEarnings.toFixed(2)}`}
            change="+12% this month"
            color="text-green-400"
          />
          <StatCard
            icon={Users}
            title="Total Sales"
            value={stats.totalSales}
            change="+3 this week"
            color="text-blue-400"
          />
          <StatCard
            icon={Music2}
            title="Albums"
            value={stats.albumCount}
            color="text-purple-400"
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Recent Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentSales.map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-purple-600/20 rounded-lg">
                            {sale.type === 'album' ? 
                              <Music2 className="w-4 h-4 text-purple-400" /> : 
                              <Video className="w-4 h-4 text-pink-400" />
                            }
                          </div>
                          <div>
                            <p className="text-white font-medium">{sale.item}</p>
                            <p className="text-gray-400 text-sm">{sale.buyer} • {sale.date}</p>
                          </div>
                        </div>
                        <div className="text-green-400 font-bold">+GH₵ {sale.amount.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Upload New Album
                  </Button>
                  <Button className="w-full justify-start bg-pink-600 hover:bg-pink-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Upload New Video
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-slate-700 text-white hover:bg-slate-800">
                    <Download className="w-4 h-4 mr-2" />
                    Download Sales Report
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-slate-700 text-white hover:bg-slate-800">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">My Content</h2>
              <div className="flex space-x-2">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Album
                </Button>
                <Button className="bg-pink-600 hover:bg-pink-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Video
                </Button>
              </div>
            </div>
            
            <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <Music2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No content yet</h3>
                  <p className="text-gray-400 mb-6">Start by uploading your first album or video</p>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    Upload Content
                  </Button>
                </div>
              </CardContent>
            </Card>
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