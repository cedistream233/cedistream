import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Legend } from 'recharts';
import { Eye, DollarSign } from 'lucide-react';

export default function Analytics({ creatorId, token }) {
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ viewsThisMonth: 0, monthlyRevenue: 0 });
  // series holds objects { date, revenue, sales }
  const [series, setSeries] = useState([]);

  // Filter state: 'last7' | 'month' | 'year'
  const [filter, setFilter] = useState('last7');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const years = useMemo(() => {
    const start = now.getFullYear() - 4;
    return Array.from({ length: 5 }, (_, i) => start + i).reverse();
  }, [now]);

  function startEndFor(filterType) {
    if (filterType === 'last7') {
      const end = new Date();
      end.setHours(23,59,59,999);
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0,0,0,0);
      return { start, end };
    }
    if (filterType === 'month') {
      const y = year;
      const m = month - 1;
      const start = new Date(y, m, 1, 0,0,0,0);
      const end = new Date(y, m + 1, 0, 23,59,59,999);
      return { start, end };
    }
    // year
    const y = year;
    const start = new Date(y, 0, 1, 0,0,0,0);
    const end = new Date(y, 11, 31, 23,59,59,999);
    return { start, end };
  }

  useEffect(() => {
    if (!creatorId) return;
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const { start, end } = startEndFor(filter);
        const qs = new URLSearchParams({ start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) });
        const res = await fetch(`/api/creators/${creatorId}/analytics?${qs.toString()}`, { headers });
        if (!res.ok) throw new Error('Failed to load analytics');
        const data = await res.json();
        if (!mounted) return;
        setOverview({ viewsThisMonth: data.viewsThisMonth || 0, monthlyRevenue: data.monthlyRevenue || 0 });
        // data.series expected as [{date: 'YYYY-MM-DD' or 'YYYY-MM', revenue: number, sales: number}]
        setSeries(data.series || []);
      } catch (e) {
        console.error(e);
        if (mounted) setSeries([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, [creatorId, token, filter, year, month]);

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
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-3">
                <label className="inline-flex items-center text-sm">
                  <input type="radio" className="mr-2" checked={filter === 'last7'} onChange={() => setFilter('last7')} />
                  Past 7 days
                </label>
                <label className="inline-flex items-center text-sm">
                  <input type="radio" className="mr-2" checked={filter === 'month'} onChange={() => setFilter('month')} />
                  Month
                </label>
                <label className="inline-flex items-center text-sm">
                  <input type="radio" className="mr-2" checked={filter === 'year'} onChange={() => setFilter('year')} />
                  Year
                </label>

                {(filter === 'month' || filter === 'year') && (
                  <select className="ml-4 p-1 rounded bg-slate-800 text-white" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map(y => (<option key={y} value={y}>{y}</option>))}
                  </select>
                )}

                {filter === 'month' && (
                  <select className="ml-2 p-1 rounded bg-slate-800 text-white" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (<option key={m} value={m}>{String(m).padStart(2,'0')}</option>))}
                  </select>
                )}
              </div>

              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series.map(s => ({ date: s.date, views: s.sales || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
                    <XAxis dataKey="date" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                    <Tooltip wrapperStyle={{ background: '#0f1724', border: '1px solid #334155' }} />
                    <Line type="monotone" dataKey="views" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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
                <BarChart data={series.map(s => ({ date: s.date, revenue: s.revenue || 0 }))}>
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
              <LineChart data={(series || []).map((s) => ({ date: s.date, views: s.sales || 0, revenue: s.revenue || 0 }))}>
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
