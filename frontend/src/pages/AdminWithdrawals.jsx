import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function AdminWithdrawals() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState({ open: false, id: null, action: null });
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState({ counts: { requested: 0, processing: 0, paid: 0, rejected: 0, cancelled: 0 } });
  const [activeTab, setActiveTab] = useState('pending'); // pending | paid | rejected
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTab === 'pending') params.set('status', 'requested,processing');
      if (activeTab === 'paid') params.set('status', 'paid');
      if (activeTab === 'rejected') params.set('status', 'rejected,cancelled');
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await fetch(`/api/withdrawals/admin?${params.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error('Failed to load withdrawals');
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setRows(items);
      if (typeof data?.total === 'number') setTotal(data.total);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/withdrawals/admin/summary', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.ok) setSummary(await res.json());
    } catch {}
  };

  useEffect(() => { fetchRows(); fetchSummary(); /* eslint-disable-next-line */ }, [token, activeTab, page, limit]);

  const openAction = (id, action) => setConfirm({ open: true, id, action });
  const closeAction = () => setConfirm({ open: false, id: null, action: null });

  const doAction = async () => {
    const { id, action } = confirm;
    if (!id || !action) return;
    try {
      const body = { status: action, notes: notes || undefined };
      const res = await fetch(`/api/withdrawals/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Action failed');
      }
      closeAction();
      setNotes('');
      await fetchRows();
    } catch (e) {
      alert(e.message || 'Failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-4">Withdrawal Requests</h1>
      <p className="text-sm text-gray-400 mb-6">Approve or decline creators' withdrawal requests after manual payment.</p>

      {/* Summary cards */}
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

      {/* Filters and Export */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="p-2 rounded bg-slate-800 border border-slate-700 text-gray-200" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="p-2 rounded bg-slate-800 border border-slate-700 text-gray-200" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setPage(1); fetchRows(); }} className="bg-slate-700 hover:bg-slate-600">Apply</Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const params = new URLSearchParams();
              if (activeTab === 'pending') params.set('status', 'requested,processing');
              if (activeTab === 'paid') params.set('status', 'paid');
              if (activeTab === 'rejected') params.set('status', 'rejected,cancelled');
              if (from) params.set('from', from);
              if (to) params.set('to', to);
              params.set('page', String(page));
              params.set('limit', String(limit));
              const res = await fetch(`/api/withdrawals/admin/export?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
              if (!res.ok) return alert('Export failed');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'withdrawals.csv'; a.click();
              URL.revokeObjectURL(url);
            }}
          >Export CSV</Button>
        </div>
      </div>

      {/* Pager */}
      <div className="flex items-center justify-between mb-4 text-gray-300">
        <div>
          Page {page} • Showing {rows.length} of {total} • Per page:
          <select value={limit} onChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(1); }} className="ml-2 bg-slate-800 border border-slate-700 rounded p-1">
            {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="space-x-2">
          <Button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))} className="bg-slate-700 hover:bg-slate-600">Prev</Button>
          <Button disabled={(page*limit) >= total} onClick={() => setPage(p => p+1)} className="bg-slate-700 hover:bg-slate-600">Next</Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900/50 mb-4">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="rejected">Declined</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          {loading ? (
            <div className="text-gray-300">Loading...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : (
            <Card className="bg-slate-900/60 border-slate-700 p-4">
              {rows.length === 0 ? (
                <div className="text-gray-400">No requests.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-400">
                      <tr>
                        <th className="p-2">Requested At</th>
                        <th className="p-2">Creator</th>
                        <th className="p-2">Contact</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Destination</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-200">
                      {rows.map(r => (
                        <tr key={r.id} className="border-t border-slate-800">
                          <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                          <td className="p-2">{r.first_name} {r.last_name} ({r.username || r.email})</td>
                          <td className="p-2">{r.phone || '—'}</td>
                          <td className="p-2">GH₵ {Number(r.amount).toFixed(2)} <span className="text-xs text-gray-400">(to receive {Number(r.amount_to_receive).toFixed(2)})</span></td>
                          <td className="p-2">{r.destination_type}: {r.destination_account}</td>
                          <td className="p-2">{r.status}</td>
                          <td className="p-2 space-x-2">
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openAction(r.id, 'processing')}>Mark Processing</Button>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openAction(r.id, 'paid')}>Mark Paid</Button>
                            <Button size="sm" variant="destructive" onClick={() => openAction(r.id, 'rejected')}>Decline</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
        <TabsContent value="paid">
          {loading ? <div className="text-gray-300">Loading...</div> : (
            <Card className="bg-slate-900/60 border-slate-700 p-4">
              {rows.length === 0 ? <div className="text-gray-400">No paid withdrawals in range.</div> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-400">
                      <tr>
                        <th className="p-2">Processed At</th>
                        <th className="p-2">Creator</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Reference</th>
                        <th className="p-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-200">
                      {rows.map(r => (
                        <tr key={r.id} className="border-t border-slate-800">
                          <td className="p-2">{r.processed_at ? new Date(r.processed_at).toLocaleString() : '—'}</td>
                          <td className="p-2">{r.first_name} {r.last_name} ({r.username || r.email})</td>
                          <td className="p-2">GH₵ {Number(r.amount_to_receive).toFixed(2)}</td>
                          <td className="p-2">{r.reference || '—'}</td>
                          <td className="p-2">{r.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
        <TabsContent value="rejected">
          {loading ? <div className="text-gray-300">Loading...</div> : (
            <Card className="bg-slate-900/60 border-slate-700 p-4">
              {rows.length === 0 ? <div className="text-gray-400">No declined withdrawals in range.</div> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-400">
                      <tr>
                        <th className="p-2">Processed At</th>
                        <th className="p-2">Creator</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-200">
                      {rows.map(r => (
                        <tr key={r.id} className="border-t border-slate-800">
                          <td className="p-2">{r.processed_at ? new Date(r.processed_at).toLocaleString() : '—'}</td>
                          <td className="p-2">{r.first_name} {r.last_name} ({r.username || r.email})</td>
                          <td className="p-2">GH₵ {Number(r.amount).toFixed(2)}</td>
                          <td className="p-2">{r.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
      {loading ? (
        <div className="text-gray-300">Loading...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : (
        <Card className="bg-slate-900/60 border-slate-700 p-4">
          {rows.length === 0 ? (
            <div className="text-gray-400">No pending requests.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-400">
                  <tr>
                    <th className="p-2">Requested At</th>
                    <th className="p-2">Creator</th>
                    <th className="p-2">Contact</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Destination</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-slate-800">
                      <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="p-2">{r.first_name} {r.last_name} ({r.username || r.email})</td>
                      <td className="p-2">{r.phone || '—'}</td>
                      <td className="p-2">GH₵ {Number(r.amount).toFixed(2)} <span className="text-xs text-gray-400">(to receive {Number(r.amount_to_receive).toFixed(2)})</span></td>
                      <td className="p-2">{r.destination_type}: {r.destination_account}</td>
                      <td className="p-2">{r.status}</td>
                      <td className="p-2 space-x-2">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openAction(r.id, 'processing')}>Mark Processing</Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openAction(r.id, 'paid')}>Mark Paid</Button>
                        <Button size="sm" variant="destructive" onClick={() => openAction(r.id, 'rejected')}>Decline</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <div className="mt-6 max-w-xl">
        <label className="block text-sm text-gray-400 mb-1">Internal notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-gray-200" rows={3} placeholder="Transaction reference, operator, etc." />
      </div>

      <ConfirmModal
        isOpen={confirm.open}
        onClose={closeAction}
        onConfirm={doAction}
        title={confirm.action === 'paid' ? 'Mark as Paid' : confirm.action === 'rejected' ? 'Decline Request' : 'Move to Processing'}
        description={confirm.action === 'paid' ? 'Confirm you have manually sent the funds to the creator. This will mark the request as paid.' : confirm.action === 'rejected' ? 'This will decline the request. Are you sure?' : 'This will mark the request as processing.'}
        confirmText={confirm.action === 'rejected' ? 'Decline' : 'Confirm'}
      />
    </div>
  );
}
