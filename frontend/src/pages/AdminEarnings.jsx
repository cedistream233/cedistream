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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      // Pull only completed purchases; we only need created_at and platform_net
      const res = await fetch('/api/purchases?payment_status=completed', {
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
    if (to) list = list.filter(r => new Date(r.created_at) <= new Date(to));
    return list;
  }, [rows, from, to]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const d = new Date(r.created_at);
      let key = d.toISOString().slice(0,10);
      if (mode === 'monthly') key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (mode === 'yearly') key = `${d.getFullYear()}`;
      const v = Number(r.platform_net || 0);
      map.set(key, +(Number(map.get(key) || 0) + v).toFixed(2));
    }
    const arr = Array.from(map.entries()).map(([k,v]) => ({ key:k, amount:v }));
    arr.sort((a,b) => a.key.localeCompare(b.key));
    return arr;
  }, [filtered, mode]);

  const total = grouped.reduce((s, r) => s + Number(r.amount || 0), 0);

  const exportCsv = () => {
    const header = ['Period','Platform net (GHS)'];
    const lines = [header.join(',')];
    for (const r of grouped) lines.push(`${r.key},${r.amount}`);
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-800 rounded p-1">
            {['daily','monthly','yearly'].map(m => (
              <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded ${mode===m?'bg-indigo-600 text-white':'text-gray-300 hover:text-white'}`}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-sm bg-slate-800 text-green-300 px-3 py-1 rounded">Total GH₵ {total.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="p-2 rounded bg-slate-800 border border-slate-700 text-gray-200" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="p-2 rounded bg-slate-800 border border-slate-700 text-gray-200" />
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} className="bg-slate-700 hover:bg-slate-600">Refresh</Button>
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
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
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="px-4 py-2">{mode === 'daily' ? 'Day' : mode === 'monthly' ? 'Month' : 'Year'}</th>
                  <th className="px-4 py-2">Platform net (GHS)</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {grouped.map(r => (
                  <tr key={r.key} className="border-t border-slate-800">
                    <td className="px-4 py-2">{r.key}</td>
                    <td className="px-4 py-2">{Number(r.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}
