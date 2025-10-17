import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/ui/Pagination';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AdminLayout from '@/AdminLayout';

// Convert a date string (YYYY-MM-DD) to an inclusive end-of-day ISO timestamp
function toInclusiveEndOfDay(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export default function AdminWithdrawals() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState({ open: false, id: null, action: null });
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState({ counts: { requested: 0, paid: 0, rejected: 0, cancelled: 0 } });
  const [activeTab, setActiveTab] = useState('pending'); // pending | paid | rejected
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const cacheRef = useRef(new Map()); // key -> { items, total }
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchRows = async () => {
    let myReq = null;
    try {
      setLoading(true);
      myReq = ++requestIdRef.current;
      const params = new URLSearchParams();
      if (activeTab === 'pending') params.set('status', 'requested');
      if (activeTab === 'paid') params.set('status', 'paid');
      if (activeTab === 'rejected') params.set('status', 'rejected,cancelled');
  if (from) params.set('from', from);
  if (to) params.set('to', toInclusiveEndOfDay(to));
      params.set('page', String(page));
      params.set('limit', String(limit));
      const key = `${activeTab}|${from}|${to}|${page}|${limit}`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        setRows(cached.items);
        setTotal(cached.total);
        setLoading(false);
        // we already have cached data for this key; don't issue a network request
        return;
      }
      // cancel previous
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(`/api/withdrawals/admin?${params.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
        signal: controller.signal
      });
      if (!res.ok) throw new Error('Failed to load withdrawals');
      const data = await res.json();
      // only apply results if this is still the latest request
      if (myReq !== requestIdRef.current) return;
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setRows(items);
      if (typeof data?.total === 'number') setTotal(data.total);
      cacheRef.current.set(key, { items, total: typeof data?.total === 'number' ? data.total : (items.length || 0) });
      setError('');
    } catch (e) {
      if (e && (e.name === 'AbortError' || String(e.message || '').toLowerCase().includes('aborted'))) {
        // Ignore aborted requests quietly
        return;
      }
      // only set error if this is the latest request
      if (myReq === requestIdRef.current) setError(e.message || 'Failed to load');
    } finally {
      // clear loading only if this is the latest request
      if (myReq === requestIdRef.current) setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', toInclusiveEndOfDay(to));
      const res = await fetch(`/api/withdrawals/admin/summary?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.ok) setSummary(await res.json());
    } catch {}
  };

  useEffect(() => { fetchRows(); fetchSummary(); /* eslint-disable-next-line */ }, [token, activeTab, page, limit, from, to]);

  // Abort any in-flight request when unmounting
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
    };
  }, []);

  // Prefetch next page when inputs change
  useEffect(() => {
    const prefNext = async () => {
      try {
        const nextPage = page + 1;
        const params = new URLSearchParams();
        if (activeTab === 'pending') params.set('status', 'requested');
        if (activeTab === 'paid') params.set('status', 'paid');
        if (activeTab === 'rejected') params.set('status', 'rejected,cancelled');
  if (from) params.set('from', from);
  if (to) params.set('to', toInclusiveEndOfDay(to));
        params.set('page', String(nextPage));
        params.set('limit', String(limit));
        const key = `${activeTab}|${from}|${to}|${nextPage}|${limit}`;
        if (cacheRef.current.get(key)) return;
        const res = await fetch(`/api/withdrawals/admin?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        cacheRef.current.set(key, { items, total: typeof data?.total === 'number' ? data.total : (items.length || 0) });
      } catch {}
    };
    prefNext();
  }, [activeTab, from, to, page, limit, token]);

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
      // Optimistically update UI so admin doesn't need to refresh
      closeAction();
      setNotes('');
      // Remove the processed row from current list
      setRows(prev => prev.filter(r => r.id !== id));
      // Update summary counts locally where possible
      setSummary(prev => {
        const next = { ...prev, counts: { ...(prev.counts || {}) } };
        // decrement requested if it existed
        if (typeof next.counts.requested === 'number' && next.counts.requested > 0) next.counts.requested = Math.max(0, next.counts.requested - 1);
        // increment paid or rejected depending on action
        if (action === 'paid') next.counts.paid = (next.counts.paid || 0) + 1;
        if (action === 'rejected' || action === 'cancelled') next.counts.rejected = (next.counts.rejected || 0) + 1;
        return next;
      });
      // Clear cached pages so subsequent navigation/refetch gets fresh data
      cacheRef.current.clear();
      // Fire a background refresh of the summary to reconcile server state
      fetchSummary().catch(() => {});
    } catch (e) {
      alert(e.message || 'Failed');
    }
  };

  return (
    <AdminLayout currentPageName="Withdrawals" showShortcuts>
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-500/15 border border-yellow-600/30 text-yellow-200 text-sm rounded-md p-3 mb-6">
          Amounts listed include a Paystack transfer fee of GH₵1.00. When paying creators, send the net amount shown (amount minus GH₵1).
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Admin</h1>

      {/* Summary cards */}
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

      {/* Filters and Export */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
        <div className="w-full sm:w-auto">
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full sm:w-auto p-2 rounded-md bg-slate-800 border border-slate-700 text-gray-200" />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full sm:w-auto p-2 rounded-md bg-slate-800 border border-slate-700 text-gray-200" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={() => { setPage(1); fetchRows(); }} className="bg-indigo-600 hover:bg-indigo-700 rounded-md w-full sm:w-auto px-4 py-2">Apply</Button>
          <Button
            variant="secondary"
            className="rounded-md w-full sm:w-auto px-4 py-2"
            onClick={async () => {
              const params = new URLSearchParams();
              if (activeTab === 'pending') params.set('status', 'requested');
              if (activeTab === 'paid') params.set('status', 'paid');
              if (activeTab === 'rejected') params.set('status', 'rejected,cancelled');
              if (from) params.set('from', from);
              if (to) params.set('to', toInclusiveEndOfDay(to));
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
      {/* pagination moved below the requests display */}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900/50 mb-4">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="paid">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Declined</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          {loading ? (
            <div className="text-gray-300">Loading...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : rows.length === 0 ? (
            <Card className="bg-slate-900/60 border-slate-700 p-4">
              <div className="text-gray-400">No pending withdrawals.</div>
            </Card>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {rows.map(r => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Card className="bg-slate-900/60 border-slate-700">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-indigo-300">{r.username ? `@${r.username}` : r.email}</div>
                            <div className="font-semibold text-white">{r.first_name || r.last_name ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : 'Creator'}</div>
                            <div className="text-green-300 font-semibold mt-1">GH₵ {Number(r.amount).toFixed(2)} <span className="text-xs text-gray-400">net GH₵ {Number(r.amount_to_receive).toFixed(2)}</span></div>
                            <div className="text-sm text-gray-300 mt-1">Send via {r.destination_type === 'mobile_money' ? 'Mobile Money' : r.destination_type}: {r.destination_account}</div>
                            <div className="text-xs text-gray-400 mt-1">Mobile: {r.phone || '—'} • Requested: {new Date(r.created_at).toLocaleString()}</div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                            <Button className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap" onClick={() => openAction(r.id, 'paid')}>Sent</Button>
                            <Button variant="destructive" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap" onClick={() => openAction(r.id, 'rejected')}>Decline</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
        <TabsContent value="paid">
          {loading ? <div className="text-gray-300">Loading...</div> : (
            <Card className="bg-slate-900/60 border-slate-700 p-4">
              {rows.length === 0 ? <div className="text-gray-400">No paid withdrawals in range.</div> : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-gray-400">
                        <tr>
                          <th className="p-2 whitespace-nowrap">Processed At</th>
                          <th className="p-2 whitespace-nowrap">Creator</th>
                          <th className="p-2 whitespace-nowrap">Amount</th>
                          <th className="p-2 whitespace-nowrap">Reference</th>
                          <th className="p-2 whitespace-nowrap">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-200">
                        {rows.map(r => (
                          <tr key={r.id} className="border-t border-slate-800">
                            <td className="p-2 whitespace-nowrap">{r.processed_at ? new Date(r.processed_at).toLocaleString() : '—'}</td>
                            <td className="p-2">{r.first_name} {r.last_name} ({r.username || r.email})</td>
                            <td className="p-2 whitespace-nowrap">GH₵ {Number(r.amount_to_receive).toFixed(2)}</td>
                            <td className="p-2">{r.reference || '—'}</td>
                            <td className="p-2">{r.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
        <TabsContent value="rejected">
          {loading ? <div className="text-gray-300">Loading...</div> : (
            <Card className="bg-slate-900/60 border-slate-700 p-4">
              {rows.length === 0 ? <div className="text-gray-400">No declined withdrawals in range.</div> : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-gray-400">
                        <tr>
                          <th className="p-2 whitespace-nowrap">Processed At</th>
                          <th className="p-2 whitespace-nowrap">Creator</th>
                          <th className="p-2 whitespace-nowrap">Amount</th>
                          <th className="p-2 whitespace-nowrap">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-200">
                        {rows.map(r => (
                          <tr key={r.id} className="border-t border-slate-800">
                            <td className="p-2 whitespace-nowrap">{r.processed_at ? new Date(r.processed_at).toLocaleString() : '—'}</td>
                            <td className="p-2">{r.first_name} {r.last_name} ({r.username || r.email})</td>
                            <td className="p-2 whitespace-nowrap">GH₵ {Number(r.amount).toFixed(2)}</td>
                            <td className="p-2">{r.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmModal
        isOpen={confirm.open}
        onClose={closeAction}
        onConfirm={doAction}
        title={confirm.action === 'paid' ? 'Mark as Paid' : confirm.action === 'rejected' ? 'Decline Request' : 'Confirm Action'}
        description={confirm.action === 'paid' ? 'Confirm you have manually sent the funds to the creator. This will mark the request as paid.' : confirm.action === 'rejected' ? 'This will decline the request. Are you sure?' : 'Confirm this action.'}
        confirmText={confirm.action === 'rejected' ? 'Decline' : 'Confirm'}
      >
        <div className="px-4 pt-2">
          <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-gray-200" rows={3} placeholder="Reason for decline or notes for this request"></textarea>
        </div>
      </ConfirmModal>
      

      {/* Pagination - unified component (moved slightly lower on mobile) */}
      <div className="mt-8 sm:mt-6 mb-10">
        <div className="flex justify-center">
          <Pagination
            page={page}
            total={total}
            limit={limit}
            onChange={(p) => setPage(Math.max(1, Math.min(p, Math.max(1, Math.ceil((total||0)/limit))))) }
          />
        </div>
      </div>
    </div>
    </AdminLayout>
  );
}
