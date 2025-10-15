import React, { useEffect, useState } from 'react';

export default function PromotionsBanner() {
  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('promotions:dismissed');
    if (dismissed === '1') {
      setHidden(true);
      return;
    }

    let mounted = true;
    fetch('/api/promotions')
      .then((r) => r.json())
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) setItems(data.slice(0, 6));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  if (hidden || items.length === 0) return null;

  return (
    <div className="bg-slate-900 border-b border-purple-900/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3 overflow-x-auto">
        {items.map((it) => (
          <a
            key={it.id}
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-[220px] bg-slate-800/70 border border-slate-700 rounded-lg p-3 flex-shrink-0 hover:scale-[1.01] transition-transform"
          >
            {it.image && <img src={it.image} alt="" className="w-full h-20 object-cover rounded-sm mb-2" />}
            <div className="text-sm font-semibold text-white">{it.title}</div>
            <div className="text-xs text-gray-300 truncate">{it.description}</div>
          </a>
        ))}

        <button
          onClick={() => { localStorage.setItem('promotions:dismissed', '1'); setHidden(true); }}
          className="ml-auto text-xs text-gray-400 hover:text-white"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
