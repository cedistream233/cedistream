import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Legend } from 'recharts';
import { Eye, DollarSign } from 'lucide-react';

export default function Analytics({ creatorId, token }) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ viewsThisMonth: 0, monthlyRevenue: 0 });
  const [viewsSeries, setViewsSeries] = useState([]);
  const [revenueSeries, setRevenueSeries] = useState([]);

  useEffect(() => {
    if (!creatorId) return;
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/creators/${creatorId}/analytics`, { headers });
        if (!res.ok) throw new Error('Failed to load analytics');
        const data = await res.json();
        if (!mounted) return;
        setOverview({ viewsThisMonth: data.viewsThisMonth || 0, monthlyRevenue: data.monthlyRevenue || 0 });
        // expect series like [{date: '2025-10-01', views: 12, revenue: 5.2}, ...]
        setViewsSeries((data.series || []).map(s => ({ date: s.date, views: s.views || 0 })));
        setRevenueSeries((data.series || []).map(s => ({ date: s.date, revenue: s.revenue || 0 })));
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, [creatorId, token]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center"><Eye className="w-5 h-5 mr-2"/> Views This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{overview.viewsThisMonth.toLocaleString()}</div>
            <p className="text-gray-400 text-sm mt-2">Daily views (All time)</p>
            <div style={{ width: '100%', height: 160 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={viewsSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
                  <XAxis dataKey="date" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <Tooltip wrapperStyle={{ background: '#0f1724', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="views" stroke="#7c3aed" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center"><DollarSign className="w-5 h-5 mr-2"/> Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">GH₵ {Number(overview.monthlyRevenue || 0).toFixed(2)}</div>
            <p className="text-gray-400 text-sm mt-2">Daily revenue (All time)</p>
            <div style={{ width: '100%', height: 160 }} className="mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
                  <XAxis dataKey="date" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <Tooltip wrapperStyle={{ background: '#0f1724', border: '1px solid #334155' }} />
                  <Bar dataKey="revenue" fill="#fb7185" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined larger area for more detail */}
      <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Detailed (All time)</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(viewsSeries || []).map((v, i) => ({ date: v.date, views: v.views, revenue: revenueSeries[i]?.revenue || 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
                <XAxis dataKey="date" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <Tooltip wrapperStyle={{ background: '#0f1724', border: '1px solid #334155' }} />
                <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                <Line yAxisId="left" type="monotone" dataKey="views" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#fb7185" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
