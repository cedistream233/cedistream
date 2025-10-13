import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, CheckCircle2, Clock3, FileDown, Users } from 'lucide-react';

export default function AdminLayout({ children, currentPageName }) {
  const location = useLocation();
  const nav = [
    { label: 'Dashboard', to: '/admin', icon: BarChart3 },
    { label: 'Withdrawals', to: '/admin/withdrawals', icon: CheckCircle2 },
    // Future: Users, Reports
  ];
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
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
