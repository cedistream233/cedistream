import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/AdminLayout';
import Pagination from '@/components/ui/Pagination';

export default function AdminHome() {
  const { token } = useAuth();
  const [summary, setSummary] = useState({ counts: { requested: 0, paid: 0, rejected: 0, cancelled: 0 } });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetch('/api/withdrawals/admin/summary', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (s.ok) setSummary(await s.json());
        const r = await fetch(`/api/withdrawals/admin?status=paid&page=${page}&limit=${limit}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (r.ok) {
          const data = await r.json();
          setRecent(Array.isArray(data?.items) ? data.items : []);
          if (typeof data?.total === 'number') setTotal(data.total);
        }
      } finally { setLoading(false); }
    })();
  }, [token]);

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
