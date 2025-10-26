import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// Simple client aggregation using purchases endpoint; in production, move to dedicated analytics API
export default function AdminEarnings() {
  const { token } = useAuth();
  const [mode, setMode] = useState('daily'); // daily | monthly | yearly
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Convert a date string (YYYY-MM-DD) to an inclusive end-of-day ISO timestamp
  function toInclusiveEndOfDay(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      // Pull only completed purchases; we only need created_at and platform_net
      const params = new URLSearchParams();
      params.set('payment_status', 'completed');
  if (from) params.set('from', from);
  if (to) params.set('to', toInclusiveEndOfDay(to));
      const res = await fetch(`/api/purchases?${params.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [token]);

  const filtered = useMemo(() => {
    let list = rows;
    if (from) list = list.filter(r => new Date(r.created_at) >= new Date(from));
    if (to) list = list.filter(r => new Date(r.created_at) <= new Date(toInclusiveEndOfDay(to)));
    return list;
  }, [rows, from, to]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const d = new Date(r.created_at);
      let key = d.toISOString().slice(0,10);
      if (mode === 'monthly') key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (mode === 'yearly') key = `${d.getFullYear()}`;

      const gross = Number(r.amount || 0);
      const platform_fee = Number(r.platform_fee || 0);
      const paystack_fee = Number(r.paystack_fee || 0);
      const platform_net = Number(r.platform_net || 0);
      const creator_amount = Number(r.creator_amount || 0);

      const cur = map.get(key) || { gross:0, platform_fee:0, paystack_fee:0, platform_net:0, creator_amount:0 };
      cur.gross = +(cur.gross + gross).toFixed(2);
      cur.platform_fee = +(cur.platform_fee + platform_fee).toFixed(2);
      cur.paystack_fee = +(cur.paystack_fee + paystack_fee).toFixed(2);
      cur.platform_net = +(cur.platform_net + platform_net).toFixed(2);
      cur.creator_amount = +(cur.creator_amount + creator_amount).toFixed(2);
      map.set(key, cur);
    }
  const arr = Array.from(map.entries()).map(([k,v]) => ({ key:k, ...v }));
  // Sort descending so the latest periods/dates appear first in the admin UI
  arr.sort((a,b) => b.key.localeCompare(a.key));
    return arr;
  }, [filtered, mode]);

  const totals = grouped.reduce((acc, r) => {
    acc.gross += Number(r.gross || 0);
    acc.platform_fee += Number(r.platform_fee || 0);
    acc.paystack_fee += Number(r.paystack_fee || 0);
    acc.platform_net += Number(r.platform_net || 0);
    acc.creator_amount += Number(r.creator_amount || 0);
    return acc;
  }, { gross:0, platform_fee:0, paystack_fee:0, platform_net:0, creator_amount:0 });

  const exportCsv = async () => {
    // Try server-side export first (admin endpoint). If it fails, fallback to client-side CSV.
    try {
      const params = new URLSearchParams();
      if (mode) params.set('mode', mode);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/admin/earnings-export?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `platform-earnings-${mode}.csv`; a.click();
        URL.revokeObjectURL(url);
        return;
      }
    } catch (e) {
      // ignore and fallback
    }

    // Fallback: client-side CSV
    const header = ['Period','Gross (GHS)','Platform fee (GHS)','Paystack fee (GHS)','Platform net (GHS)','Creator amount (GHS)'];
    const lines = [header.join(',')];
    for (const r of grouped) lines.push([r.key, r.gross.toFixed(2), r.platform_fee.toFixed(2), r.paystack_fee.toFixed(2), r.platform_net.toFixed(2), r.creator_amount.toFixed(2)].join(','));
    // add totals row
    lines.push(['TOTAL', totals.gross.toFixed(2), totals.platform_fee.toFixed(2), totals.paystack_fee.toFixed(2), totals.platform_net.toFixed(2), totals.creator_amount.toFixed(2)].join(','));
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'platform-earnings.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout currentPageName="Platform earnings" showShortcuts>
      <h1 className="text-2xl font-bold mb-4">Platform earnings</h1>
      <Card className="bg-slate-900/60 border-slate-700 p-4 mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="inline-flex bg-slate-800 rounded p-1 w-full sm:w-auto">
              {['daily','monthly','yearly'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 sm:flex-none px-3 py-1 rounded-md ${mode===m ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'}`}
                >{m.charAt(0).toUpperCase()+m.slice(1)}</button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto w-full sm:w-auto">
              <div className="text-sm bg-slate-800 text-green-300 px-3 py-1 rounded-md whitespace-nowrap">Total Gross GH₵ {totals.gross.toFixed(2)}</div>
              <div className="text-sm bg-slate-800 text-yellow-300 px-3 py-1 rounded-md whitespace-nowrap">Platform net GH₵ {totals.platform_net.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="w-full sm:w-auto">
              <label className="block text-xs text-gray-400 mb-1">From</label>
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-gray-200" />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs text-gray-400 mb-1">To</label>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-gray-200" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={fetchData} className="bg-slate-700 hover:bg-slate-600 rounded-md flex-1 sm:flex-none">Refresh</Button>
              <Button variant="secondary" onClick={exportCsv} className="rounded-md flex-1 sm:flex-none">Export CSV</Button>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-gray-300">Loading...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : (
        <Card className="bg-slate-900/60 border-slate-700 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-400">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 whitespace-nowrap">{mode === 'daily' ? 'Day' : mode === 'monthly' ? 'Month' : 'Year'}</th>
                    <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Gross (GHS)</th>
                    <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Platform fee</th>
                    <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Paystack fee</th>
                    <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Platform net</th>
                    <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Creator amount</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {grouped.map(r => (
                    <tr key={r.key} className="border-t border-slate-800">
                      <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{r.key}</td>
                      <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{Number(r.gross).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{Number(r.platform_fee).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{Number(r.paystack_fee).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{Number(r.platform_net).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{Number(r.creator_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-800 font-semibold">
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">TOTAL</td>
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{totals.gross.toFixed(2)}</td>
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{totals.platform_fee.toFixed(2)}</td>
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{totals.paystack_fee.toFixed(2)}</td>
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{totals.platform_net.toFixed(2)}</td>
                    <td className="px-2 sm:px-4 py-2 whitespace-nowrap">{totals.creator_amount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}
