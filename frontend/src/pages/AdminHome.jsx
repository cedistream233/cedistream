import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/AdminLayout';
import Pagination from '@/components/ui/Pagination';

// Convert a date string (YYYY-MM-DD) to an inclusive end-of-day ISO timestamp
function toInclusiveEndOfDay(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export default function AdminHome() {
  const { token } = useAuth();
  const [summary, setSummary] = useState({ counts: { requested: 0, paid: 0, rejected: 0, cancelled: 0 } });
  const [recent, setRecent] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const cacheRef = useRef(new Map());

  // Fetch summary (optionally filtered) when token or date filters change
  useEffect(() => {
    (async () => {
      try {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', toInclusiveEndOfDay(to));
        params.set('includePlatformNet', '1');
        const s = await fetch(`/api/withdrawals/admin/summary?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (s.ok) setSummary(await s.json());
      } catch {}
    })();
  }, [token, from, to]);

  // Fetch recent list with caching and respect page/limit
  useEffect(() => {
    (async () => {
      try {
        const key = `${page}|${limit}`;
        const cached = cacheRef.current.get(key);
        if (cached) {
          setRecent(cached.items);
          setTotal(cached.total);
          setLoading(false);
        } else {
          setLoading(true);
        }
  const params = new URLSearchParams();
  params.set('status', 'paid');
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (from) params.set('from', from);
  if (to) params.set('to', toInclusiveEndOfDay(to));
  const r = await fetch(`/api/withdrawals/admin?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (r.ok) {
          const data = await r.json();
          const items = Array.isArray(data?.items) ? data.items : [];
          setRecent(items);
          const t = typeof data?.total === 'number' ? data.total : items.length || 0;
          setTotal(t);
          cacheRef.current.set(key, { items, total: t });
        }
      } finally { setLoading(false); }
    })();
  }, [page, limit, token]);

  // Prefetch next page
  useEffect(() => {
    (async () => {
      const nextPage = page + 1;
      const key = `${nextPage}|${limit}`;
      if (cacheRef.current.get(key)) return;
  const params = new URLSearchParams();
  params.set('status', 'paid');
  params.set('page', String(nextPage));
  params.set('limit', String(limit));
  if (from) params.set('from', from);
  if (to) params.set('to', toInclusiveEndOfDay(to));
  const r = await fetch(`/api/withdrawals/admin?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }).catch(() => null);
      if (r && r.ok) {
        const data = await r.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        cacheRef.current.set(key, { items, total: typeof data?.total === 'number' ? data.total : items.length || 0 });
      }
    })();
  }, [page, limit, token]);

  return (
    <AdminLayout currentPageName="Admin Dashboard" showShortcuts>
      <div className="mb-4">
        <div className="bg-yellow-500/15 border border-yellow-600/30 text-yellow-200 text-sm rounded-md p-3">
          Amounts listed include a Paystack transfer fee of GH₵1.00. When paying creators, send the net amount shown (amount minus GH₵1).
        </div>
      </div>
      <h1 className="text-3xl font-bold mb-6">Admin</h1>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Requested', value: summary.counts.requested, color: 'bg-yellow-100 text-yellow-800', ring: 'ring-yellow-500/20' },
          { label: 'Paid', value: summary.counts.paid, color: 'bg-green-100 text-green-800', ring: 'ring-green-500/20' },
          { label: 'Declined', value: summary.counts.rejected + summary.counts.cancelled, color: 'bg-red-100 text-red-800', ring: 'ring-red-500/20' },
        ].map((c) => (
          <Card key={c.label} className={`bg-slate-900/50 border-slate-700 p-4 flex items-center justify-between ${c.ring}`}>
            <div>
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${c.color}`}>{c.label}</div>
              <div className="mt-2 text-2xl font-bold text-white">{c.value || 0}</div>
            </div>
            <div className="text-sm text-gray-400">&nbsp;</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
        <div className="w-full sm:w-auto">
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full sm:w-auto p-2 rounded-md bg-slate-800 border border-slate-700 text-gray-200" />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full sm:w-auto p-2 rounded-md bg-slate-800 border border-slate-700 text-gray-200" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-sm bg-slate-800 text-green-300 px-3 py-1 rounded-md">Platform net GH₵ {Number(summary?.platform_net || 0).toFixed(2)}</div>
        </div>
      </div>

      <Card className="bg-slate-900/60 border-slate-700 p-4">
        <h2 className="text-xl font-semibold mb-3">Recent Paid Withdrawals</h2>
        {recent.length === 0 ? (
          <div className="text-gray-400">No recent items.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="p-2">Processed At</th>
                  <th className="p-2">Creator</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Reference</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {recent.map(r => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="p-2">{r.processed_at ? new Date(r.processed_at).toLocaleString() : '—'}</td>
                    <td className="p-2">{r.first_name} {r.last_name} ({r.username || r.email})</td>
                    <td className="p-2">GH₵ {Number(r.amount_to_receive).toFixed(2)}</td>
                    <td className="p-2">{r.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </Card>

        <div className="mt-4">
          <Pagination
            page={page}
            total={total}
            limit={limit}
            onChange={(p) => setPage(Math.max(1, Math.min(p, Math.max(1, Math.ceil((total||0)/limit))))) }
          />
        </div>
      
    </AdminLayout>
  );
}
