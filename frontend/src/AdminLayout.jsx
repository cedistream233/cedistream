import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle2, Music } from 'lucide-react';

export default function AdminLayout({ children, showShortcuts = true }) {
  const location = useLocation();
  const nav = [
    { label: 'Withdrawals', to: '/admin/withdrawals', icon: CheckCircle2 },
    { label: 'Promotions', to: '/admin/promotions', icon: Music },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-6">
        <div className="mx-auto max-w-7xl">

          {showShortcuts && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Link to={createPageUrl('Home')} className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">CediStream</span>
                </Link>
              </div>
              <div className="mt-3 sm:mt-0 flex items-center gap-2 flex-wrap">
                <Link to="/admin/platform-earnings" className="px-3 py-1 rounded-md bg-indigo-700/80 hover:bg-indigo-700 text-white text-sm flex-shrink-0">Platform earnings</Link>
                <Link to="/admin/support-tickets" className="px-3 py-1 rounded-md bg-pink-600/80 hover:bg-pink-600 text-white text-sm flex-shrink-0">Support Tickets</Link>
                <Link to="/admin/promotions" className="px-3 py-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm flex-shrink-0">Promotions</Link>
              </div>
            </div>
          )}

          {/* Mobile horizontal nav */}
          {nav.length > 1 && (
            <div className="w-full md:hidden mb-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {nav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex-shrink-0 px-3 py-2 rounded-md text-sm ${location.pathname === item.to ? 'bg-purple-600 text-white' : 'bg-slate-900/40 text-gray-200 hover:bg-slate-800'}`}
                  >
                    <item.icon className="w-4 h-4 inline-block mr-2" />
                    <span className="align-middle">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-6">
            {/* Desktop aside */}
            {nav.length > 1 && (
              <aside className="w-64 hidden md:block">
                <div className="sticky top-6 space-y-2">
                  {nav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border ${location.pathname === item.to ? 'bg-purple-600 border-purple-500' : 'bg-slate-900/40 border-slate-700 hover:bg-slate-800'}`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </aside>
            )}

            <main className="flex-1 min-w-0 pb-20">{children}</main>
          </div>

        </div>
      </div>
    </div>
  );
}
