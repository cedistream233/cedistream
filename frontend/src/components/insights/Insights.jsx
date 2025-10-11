import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Legend } from 'recharts';
// Note: no icon imports needed right now

export default function Insights({ creatorId, token }) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ viewsThisMonth: 0, monthlyRevenue: 0 });
  const [viewsSeries, setViewsSeries] = useState([]);
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 640 : false);
  const [range, setRange] = useState('14'); // '7' | '14'
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!creatorId) return;
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`/api/creators/${creatorId}/analytics?range=${range}`, { headers });
        if (!res.ok) throw new Error('Failed to load insights');
        const data = await res.json();
        if (!mounted) return;
  setOverview({ viewsThisMonth: data.viewsThisMonth || 0, monthlyRevenue: data.monthlyRevenue || 0 });
  setTotal(data.totalRevenue || data.monthlyRevenue || 0);
  setViewsSeries([]); // no views series now; use sales instead
  setRevenueSeries((data.series || []).map(s => ({ date: s.date, revenue: s.revenue || 0, sales: s.sales || 0 })));
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, [creatorId, token, range]);

  // track viewport size to tweak chart presentation on small screens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const combined = useMemo(() => {
    const len = revenueSeries.length;
    return Array.from({ length: len }, (_, i) => ({
      date: revenueSeries[i]?.date || '',
      revenue: revenueSeries[i]?.revenue || 0,
      sales: revenueSeries[i]?.sales || 0,
    }));
  }, [revenueSeries]);

  const xAxisInterval = useMemo(() => {
    if (!combined || combined.length === 0) return 0;
    // show ~5 ticks on mobile, full labels on desktop
    if (isMobile) return Math.max(0, Math.floor(combined.length / 5) - 1);
    return 0;
  }, [combined, isMobile]);

  const chartHeight = isMobile ? 360 : 340;
  const scrollWidth = Math.max(640, (combined?.length || 0) * (isMobile ? 24 : 20));

  return (
    <div className="space-y-6">

      <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-white">{range === '7' ? 'Last 7 days' : 'Last 14 days'}</CardTitle>
            <Tabs value={range} onValueChange={setRange} className="w-auto">
              <TabsList className="bg-slate-800/70">
                <TabsTrigger value="7" className="data-[state=active]:bg-purple-600">7d</TabsTrigger>
                <TabsTrigger value="14" className="data-[state=active]:bg-purple-600">14d</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className={isMobile ? 'p-3 space-y-3' : 'p-6 space-y-4'}>
          {/* Big total like Paystack */}
          <div className="text-center">
            <div className="text-slate-300 text-sm">Revenue GHS</div>
            <div className="text-3xl md:text-4xl font-semibold text-white">{Number(total).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>

          {/* No metric toggle; show both Revenue and Sales together on all devices */}

          {/* Single chart style (dotted dual-line) for both mobile/desktop */}
          <div style={{ width: '100%', height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combined} margin={{ top: 8, right: 24, left: 8, bottom: isMobile ? 28 : 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#cbd5e1', fontSize: isMobile ? 10 : 11 }}
                  interval={xAxisInterval}
                  tickFormatter={(d) => (d ? d.slice(5) : '')}
                  tickLine={false}
                  height={isMobile ? 24 : 20}
                  angle={isMobile ? -30 : 0}
                  textAnchor={isMobile ? 'end' : 'middle'}
                />
                <YAxis yAxisId="left" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <Tooltip wrapperStyle={{ background: '#071023', border: '1px solid #334155', color: '#e2e8f0', fontSize: isMobile ? 12 : 13 }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#cbd5e1' }} />
                <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
