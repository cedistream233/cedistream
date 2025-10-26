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
  const [range, setRange] = useState('all'); // '7' | '14' | 'all'
  const [total, setTotal] = useState(0);
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => {
    if (!creatorId) return;
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // If range is 'all' omit the range param so the backend returns all-time data.
  const url = range && range !== 'all' ? `/api/creators/${creatorId}/analytics?range=${range}` : `/api/creators/${creatorId}/analytics`;
  const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to load insights');
        const data = await res.json();
        if (!mounted) return;
  // Prefer creator/net revenue fields when available (backend may return creatorRevenue/creator_amount)
  const platformShare = 0.8; // creators receive 80% by default if backend doesn't provide net values
  const monthlyRevenue = (typeof data.monthlyRevenue !== 'undefined') ? data.monthlyRevenue : 0;
  const totalRevenue = (typeof data.totalRevenue !== 'undefined') ? data.totalRevenue : monthlyRevenue;
  // If backend provides a creator-specific total, prefer that
  const monthlyCreatorRevenue = (typeof data.monthlyCreatorRevenue !== 'undefined') ? data.monthlyCreatorRevenue : (typeof data.monthlyCreatorRevenueNet !== 'undefined' ? data.monthlyCreatorRevenueNet : null);
  const totalCreatorRevenue = (typeof data.totalCreatorRevenue !== 'undefined') ? data.totalCreatorRevenue : (typeof data.totalCreatorRevenueNet !== 'undefined' ? data.totalCreatorRevenueNet : null);

  setOverview({ viewsThisMonth: data.viewsThisMonth || 0, monthlyRevenue: (monthlyCreatorRevenue !== null ? monthlyCreatorRevenue : monthlyRevenue * platformShare) });
  setTotal(totalCreatorRevenue !== null ? totalCreatorRevenue : (totalRevenue * platformShare));
  setTotalSales(data.totalSales || 0);
  setViewsSeries([]); // no views series now; use sales instead
  // Map series and prefer creator/net revenue per point when present; otherwise multiply gross revenue by platformShare
  setRevenueSeries((data.series || []).map(s => {
    const gross = typeof s.revenue !== 'undefined' ? s.revenue : 0;
    const creatorNet = (typeof s.creator_revenue !== 'undefined') ? s.creator_revenue : (typeof s.creator_amount !== 'undefined' ? s.creator_amount : (typeof s.creatorNet !== 'undefined' ? s.creatorNet : null));
    return ({ date: s.date, revenue: (creatorNet !== null ? creatorNet : gross * platformShare), sales: s.sales || 0 });
  }));
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
  const mobilePointWidth = 48; // width allocated per day on mobile for readability
  const scrollWidth = isMobile
    ? Math.max(720, (combined?.length || 0) * mobilePointWidth)
    : Math.max(640, (combined?.length || 0) * 20);

  const formatDateLabel = (d) => {
    if (!d) return '';
    try {
      const [y, m, day] = d.split('-');
      const dt = new Date(Number(y), Number(m) - 1, Number(day));
      return dt.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const salesPoint = payload.find(p => p && p.dataKey === 'sales');
    const revenuePoint = payload.find(p => p && p.dataKey === 'revenue');
    const salesVal = salesPoint?.value ?? 0;
    const revenueVal = revenuePoint?.value ?? 0;
    return (
      <div style={{ background: '#0b1224', border: '1px solid #334155', color: '#e2e8f0', padding: '8px 10px', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
        <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>{formatDateLabel(label)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, background: '#60a5fa', borderRadius: 999 }} />
          <span style={{ color: '#cbd5e1' }}>sales:</span>
          <strong style={{ color: '#bae6fd' }}>{Number(salesVal).toLocaleString()}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, background: '#34d399', borderRadius: 999 }} />
          <span style={{ color: '#cbd5e1' }}>revenue:</span>
          <strong style={{ color: '#bbf7d0' }}>GH₵ {Number(revenueVal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">

      <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-white">{range === '7' ? 'Last 7 days' : range === '14' ? 'Last 14 days' : 'All time'}</CardTitle>
            <Tabs value={range} onValueChange={setRange} className="w-auto">
              <TabsList className="bg-slate-800/70">
                <TabsTrigger value="7" className="data-[state=active]:bg-purple-600">7d</TabsTrigger>
                <TabsTrigger value="14" className="data-[state=active]:bg-purple-600">14d</TabsTrigger>
                <TabsTrigger value="all" className="data-[state=active]:bg-purple-600">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className={isMobile ? 'p-3 space-y-3' : 'p-6 space-y-4'}>
          {/* Big total like Paystack */}
          <div className="flex items-end justify-center gap-6 flex-wrap">
            <div className="text-center">
              <div className="text-slate-300 text-sm">Revenue GHS</div>
              <div className="text-3xl md:text-4xl font-semibold text-white">{Number(total).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-slate-300 text-sm">Total Sales</div>
              <div className="text-xl md:text-2xl font-medium text-blue-300">{Number(totalSales).toLocaleString()}</div>
            </div>
          </div>

          {/* No metric toggle; show both Revenue and Sales together on all devices */}

          {/* Single chart style (dotted dual-line). On mobile, allow horizontal scroll for readability */}
          {isMobile ? (
            <div style={{ width: '100%', overflowX: 'auto' }} className="no-scrollbar">
              <div style={{ width: `${scrollWidth}px`, height: `${chartHeight}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combined} margin={{ top: 8, right: 24, left: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                      interval={0}
                      tickFormatter={(d) => (d ? d.slice(5) : '')}
                      tickLine={false}
                      height={36}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis yAxisId="left" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#cbd5e1' }} />
                    <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combined} margin={{ top: 8, right: 24, left: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                    interval={xAxisInterval}
                    tickFormatter={(d) => (d ? d.slice(5) : '')}
                    tickLine={false}
                    height={20}
                  />
                  <YAxis yAxisId="left" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#cbd5e1' }} />
                  <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
