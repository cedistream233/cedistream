import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { BarChart3, CheckCircle2, Music } from 'lucide-react';

export default function AdminLayout({ children, currentPageName, showShortcuts = true }) {
  const location = useLocation();
  const nav = [
    { label: 'Dashboard', to: '/admin', icon: BarChart3 },
    { label: 'Withdrawals', to: '/admin/withdrawals', icon: CheckCircle2 },
    // Future: Users, Reports
  ];
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Top brand + quick links */}
        {showShortcuts && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link to={createPageUrl('Home')} className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">CediStream</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin/platform-earnings" className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm">Platform earnings</Link>
              <Link to="/admin/support-tickets" className="px-3 py-2 rounded bg-pink-600 hover:bg-pink-700 text-white text-sm">Support Tickets</Link>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          <aside className="w-64 hidden md:block">
            <div className="sticky top-6 space-y-2">
              {nav.map(item => (
                <Link key={item.to} to={item.to} className={`flex items-center gap-2 px-3 py-2 rounded-md border ${location.pathname === item.to ? 'bg-purple-600 border-purple-500' : 'bg-slate-900/40 border-slate-700 hover:bg-slate-800'}`}>
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </aside>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
