import React, { useEffect, useState } from 'react';
import AdminLayout from '@/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminSupportTickets() {
  const { token } = useAuth();
  const [tab, setTab] = useState('open');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError('');
      // Placeholder: if backend lacks tickets route, keep empty list
      const res = await fetch(`/api/support-tickets?status=${tab}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRows(); /* eslint-disable-next-line */ }, [tab, token]);

  return (
    <AdminLayout currentPageName="Support Tickets" showShortcuts>
      <h1 className="text-2xl font-bold mb-4">Support Tickets</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-900/50 mb-4">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        {['open','resolved','all'].map(key => (
          <TabsContent key={key} value={key}>
            {loading ? (
              <div className="text-gray-300">Loading...</div>
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : rows.length === 0 ? (
              <Card className="bg-slate-900/60 border-slate-700 p-4">No tickets.</Card>
            ) : (
              <div className="space-y-3">
                {rows.map(t => (
                  <Card key={t.id} className="bg-slate-900/60 border-slate-700 p-0 overflow-hidden rounded-md">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold">{t.subject || '—'}</div>
                          <div className="text-sm text-indigo-300">{t.name || ''} {t.email ? ` ${t.email}` : ''}</div>
                          <div className="text-sm text-gray-300 mt-2 whitespace-pre-line">{t.message || ''}</div>
                          <div className="text-xs text-gray-400 mt-2">Opened: {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}{t.resolved_at ? ` • Resolved: ${new Date(t.resolved_at).toLocaleString()}` : ''}</div>
                        </div>
                        <div className="flex-shrink-0 ml-3 hidden sm:block">
                          <Button className="rounded-md bg-slate-700 hover:bg-slate-600">Open</Button>
                        </div>
                      </div>
                      <div className="mt-3 sm:hidden flex gap-2">
                        <Button className="rounded-md flex-1 bg-slate-700 hover:bg-slate-600">Open</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </AdminLayout>
  );
}
