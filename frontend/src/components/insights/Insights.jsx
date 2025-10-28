import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

// Custom tooltip (dark theme) — shows only the active metric when a metric toggle is used
const CustomTooltip = ({ active, payload, label, metric }) => {
  if (!active || !payload || !payload.length) return null;
  // payload will contain only the rendered dataKey (sales or revenue)
  const point = payload[0];
  const value = point?.value ?? 0;
  const isRevenue = metric === 'revenue';
  return (
    <div style={{
      background: '#071025',
      border: '1px solid rgba(100,116,139,0.18)',
      color: '#e6eef8',
      padding: 10,
      borderRadius: 8,
      boxShadow: '0 8px 30px rgba(2,6,23,0.6)',
      minWidth: 140
    }}>
      <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, background: isRevenue ? '#34d399' : '#60a5fa', borderRadius: 999 }} />
        <div style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{isRevenue ? 'revenue' : 'sales'}</div>
        <strong style={{ color: isRevenue ? '#bbf7d0' : '#bae6fd', marginLeft: 'auto' }}>{isRevenue ? `GH₵ ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : Number(value).toLocaleString()}</strong>
      </div>
    </div>
  );
};

export default function Insights({ creatorId, token }) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ viewsThisMonth: 0, monthlyRevenue: 0 });
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 640 : false);
  const [range, setRange] = useState('7'); // '7' | '14' | 'all'
  const [total, setTotal] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [metric, setMetric] = useState('revenue'); // 'revenue' | 'sales' - show only one at a time

  useEffect(() => {
    if (!creatorId) return;
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const url = range && range !== 'all' ? `/api/creators/${creatorId}/analytics?range=${range}` : `/api/creators/${creatorId}/analytics`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to load insights');
        const data = await res.json();
        if (!mounted) return;

        const platformShare = 0.8;
        const monthlyRevenue = (typeof data.monthlyRevenue !== 'undefined') ? data.monthlyRevenue : 0;
        const totalRevenue = (typeof data.totalRevenue !== 'undefined') ? data.totalRevenue : monthlyRevenue;
        const monthlyCreatorRevenue = (typeof data.monthlyCreatorRevenue !== 'undefined') ? data.monthlyCreatorRevenue : null;
        const totalCreatorRevenue = (typeof data.totalCreatorRevenue !== 'undefined') ? data.totalCreatorRevenue : null;

        setOverview({
          viewsThisMonth: data.viewsThisMonth || 0,
          monthlyRevenue: (monthlyCreatorRevenue !== null ? monthlyCreatorRevenue : monthlyRevenue * platformShare)
        });
        setTotal(totalCreatorRevenue !== null ? totalCreatorRevenue : (totalRevenue * platformShare));
        setTotalSales(data.totalSales || 0);

        // normalize series: prefer creator-specific net values if provided
        setRevenueSeries((data.series || []).map(s => {
          const gross = typeof s.revenue !== 'undefined' ? Number(s.revenue) : 0;
          const creatorNet = (typeof s.creator_revenue !== 'undefined') ? Number(s.creator_revenue)
            : (typeof s.creator_amount !== 'undefined') ? Number(s.creator_amount)
            : (typeof s.creatorNet !== 'undefined') ? Number(s.creatorNet) : null;
          return ({
            date: s.date,
            revenue: creatorNet !== null ? creatorNet : gross * platformShare,
            sales: Number(s.sales || 0)
          });
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Combine revenueSeries to chart data
  const combined = useMemo(() => {
    return (revenueSeries || []).map(r => ({ date: r.date, revenue: r.revenue || 0, sales: r.sales || 0 }));
  }, [revenueSeries]);

  // compute axis maxima with padding so lines don't hit top edge (like screenshot)
  const { maxSales, maxRevenue } = useMemo(() => {
    const maxS = combined.reduce((m, p) => Math.max(m, p.sales || 0), 0);
    const maxR = combined.reduce((m, p) => Math.max(m, p.revenue || 0), 0);
    const pad = (n) => Math.max((n === 0 ? 4 : Math.ceil(n * 1.15)), Math.ceil(n + 4));
    return { maxSales: pad(maxS), maxRevenue: pad(maxR) };
  }, [combined]);

  // Compute a less-flexible (stable) revenue axis upper bound.
  // Rounds up to a 'nice' bucket so small changes don't move the scale drastically.
  function computeFixedRevenueMax(maxR) {
    if (!maxR || maxR === 0) return 80;               // default like your screenshot
    if (maxR <= 50) return Math.ceil(maxR / 10) * 10; // nearest 10
    if (maxR <= 500) return Math.ceil(maxR / 50) * 50; // nearest 50
    return Math.ceil(maxR / 100) * 100;                // nearest 100
  }
  const fixedRevenueMax = computeFixedRevenueMax(maxRevenue);

  function computeFixedSalesMax(maxS) {
    // smaller defaults for counts
    if (!maxS || maxS === 0) return 8;
    if (maxS <= 20) return Math.ceil(maxS / 2) * 2;   // nearest 2
    if (maxS <= 100) return Math.ceil(maxS / 10) * 10; // nearest 10
    if (maxS <= 500) return Math.ceil(maxS / 50) * 50; // nearest 50
    return Math.ceil(maxS / 100) * 100;
  }
  const fixedSalesMax = computeFixedSalesMax(maxSales);

  // presentation sizes
  const chartHeight = isMobile ? 360 : 340;
  const mobilePointWidth = 48;
  const scrollWidth = isMobile ? Math.max(720, (combined?.length || 0) * mobilePointWidth) : Math.max(640, (combined?.length || 0) * 28);

  const xAxisTickFormatter = (d) => {
    if (!d) return '';
    try { if (d.length >= 7) return d.slice(5); return d; } catch { return d; }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
        <CardHeader>
          {isMobile ? (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">{range === '7' ? 'Last 7 days' : range === '14' ? 'Last 14 days' : 'All time'}</CardTitle>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                <div className="shrink-0">
                  <Tabs value={range} onValueChange={setRange} className="w-auto">
                    <TabsList className="bg-slate-800/70 rounded-md p-1">
                      <TabsTrigger value="7" className="data-[state=active]:bg-purple-600 rounded-md px-3 py-1">7d</TabsTrigger>
                      <TabsTrigger value="14" className="data-[state=active]:bg-purple-600 rounded-md px-3 py-1">14d</TabsTrigger>
                      <TabsTrigger value="all" className="data-[state=active]:bg-purple-600 rounded-md px-3 py-1">All</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="shrink-0">
                  <Tabs value={metric} onValueChange={setMetric} className="w-auto">
                    <TabsList className="bg-slate-800/70 rounded-md p-1">
                      <TabsTrigger value="revenue" className="data-[state=active]:bg-emerald-500 rounded-md px-3 py-1">Revenue</TabsTrigger>
                      <TabsTrigger value="sales" className="data-[state=active]:bg-sky-500 rounded-md px-3 py-1">Sales</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 w-full">
              <CardTitle className="text-white">{range === '7' ? 'Last 7 days' : range === '14' ? 'Last 14 days' : 'All time'}</CardTitle>
              <div className="flex items-center gap-3">
                <Tabs value={range} onValueChange={setRange} className="w-auto">
                  <TabsList className="bg-slate-800/70 rounded-md p-1">
                    <TabsTrigger value="7" className="data-[state=active]:bg-purple-600 rounded-md px-3 py-1">7d</TabsTrigger>
                    <TabsTrigger value="14" className="data-[state=active]:bg-purple-600 rounded-md px-3 py-1">14d</TabsTrigger>
                    <TabsTrigger value="all" className="data-[state=active]:bg-purple-600 rounded-md px-3 py-1">All</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="ml-3">
                  <Tabs value={metric} onValueChange={setMetric} className="w-auto">
                    <TabsList className="bg-slate-800/70 rounded-md p-1">
                      <TabsTrigger value="revenue" className="data-[state=active]:bg-emerald-500 rounded-md px-3 py-1">Revenue</TabsTrigger>
                      <TabsTrigger value="sales" className="data-[state=active]:bg-sky-500 rounded-md px-3 py-1">Sales</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className={isMobile ? 'p-3 space-y-3' : 'p-6 space-y-4'}>
          {/* KPI center */}
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

          {/* Chart area */}
          {isMobile ? (
            <div style={{ width: '100%', overflowX: 'auto' }} className="no-scrollbar">
              <div style={{ width: `${scrollWidth}px`, height: `${chartHeight}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combined} margin={{ top: 20, right: 48, left: 12, bottom: 40 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 8" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={xAxisTickFormatter} interval={0} height={36} />
                    {metric === 'sales' ? (
                      <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, Math.max(4, fixedSalesMax)]} width={48} />
                    ) : (
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, fixedRevenueMax]} width={64} />
                    )}
                    <Tooltip content={<CustomTooltip metric={metric} />} wrapperStyle={{ outline: 'none' }} />
                        {!isMobile && (
                          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#cbd5e1' }} />
                        )}
                    {metric === 'sales' ? (
                      <Line
                        yAxisId="left"
                        type="linear"
                        dataKey="sales"
                        name="sales"
                        stroke="#60a5fa"
                        strokeWidth={2.2}
                        strokeDasharray="6 4"
                        dot={{ r: 5, stroke: '#60a5fa', strokeWidth: 1.6, fill: '#ffffff' }}
                        activeDot={{ r: 6, stroke: '#e0f2ff', strokeWidth: 2, fill: '#60a5fa' }}
                        strokeLinecap="round"
                        connectNulls
                      />
                    ) : (
                      <Line
                        yAxisId="right"
                        type="linear"
                        dataKey="revenue"
                        name="revenue"
                        stroke="#34d399"
                        strokeWidth={2.4}
                        dot={{ r: 4, stroke: '#34d399', strokeWidth: 1.2, fill: '#ffffff' }}
                        activeDot={{ r: 6, stroke: '#dfffee', strokeWidth: 2, fill: '#34d399' }}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combined} margin={{ top: 20, right: 48, left: 12, bottom: 20 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 8" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} interval={Math.max(0, Math.floor((combined?.length || 1) / 7))} tickFormatter={xAxisTickFormatter} axisLine={false} tickLine={false} height={20} />
                  {metric === 'sales' ? (
                    <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, Math.max(4, fixedSalesMax)]} width={48} />
                  ) : (
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, fixedRevenueMax]} width={64} />
                  )}
                  <Tooltip content={<CustomTooltip metric={metric} />} wrapperStyle={{ outline: 'none' }} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#cbd5e1' }} />
                  {metric === 'sales' ? (
                    <Line
                      yAxisId="left"
                      type="linear"
                      dataKey="sales"
                      name="sales"
                      stroke="#60a5fa"
                      strokeWidth={2.2}
                      strokeDasharray="6 4"
                      dot={{ r: 5, stroke: '#60a5fa', strokeWidth: 1.6, fill: '#ffffff' }}
                      activeDot={{ r: 6, stroke: '#e0f2ff', strokeWidth: 2, fill: '#60a5fa' }}
                      strokeLinecap="round"
                      connectNulls
                    />
                  ) : (
                    <Line
                      yAxisId="right"
                      type="linear"
                      dataKey="revenue"
                      name="revenue"
                      stroke="#34d399"
                      strokeWidth={2.4}
                      dot={{ r: 4, stroke: '#34d399', strokeWidth: 1.2, fill: '#ffffff' }}
                      activeDot={{ r: 6, stroke: '#dfffee', strokeWidth: 2, fill: '#34d399' }}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
