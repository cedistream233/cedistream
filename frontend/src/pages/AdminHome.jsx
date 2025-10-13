import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/AdminLayout';

export default function AdminHome() {
  const { token } = useAuth();
  const [summary, setSummary] = useState({ counts: { requested: 0, processing: 0, paid: 0, rejected: 0, cancelled: 0 } });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetch('/api/withdrawals/admin/summary', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (s.ok) setSummary(await s.json());
        const r = await fetch('/api/withdrawals/admin?status=paid&page=1&limit=5', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (r.ok) {
          const data = await r.json();
          setRecent(Array.isArray(data?.items) ? data.items : []);
        }
      } finally { setLoading(false); }
    })();
  }, [token]);

  return (
    <AdminLayout currentPageName="Admin Dashboard">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Requested', value: summary.counts.requested, color: 'bg-yellow-500/20 text-yellow-300' },
          { label: 'Processing', value: summary.counts.processing, color: 'bg-blue-500/20 text-blue-300' },
          { label: 'Paid', value: summary.counts.paid, color: 'bg-green-500/20 text-green-300' },
          { label: 'Declined', value: summary.counts.rejected + summary.counts.cancelled, color: 'bg-red-500/20 text-red-300' },
        ].map((c) => (
          <Card key={c.label} className="bg-slate-900/60 border-slate-700 p-4">
            <div className={`text-sm ${c.color}`}>{c.label}</div>
            <div className="text-2xl text-white font-semibold">{c.value || 0}</div>
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
    </AdminLayout>
  );
}
