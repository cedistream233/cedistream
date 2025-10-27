import React, { useEffect, useState } from 'react';
import { buildSrcSet } from '@/utils';

export default function PromotionsBanner() {
  const [items, setItems] = useState([]);
  // dismissedMap: { [id]: timestamp }
  const [dismissedMap, setDismissedMap] = useState(() => {
    try {
      const raw = localStorage.getItem('promotions:dismissed');
      if (!raw) return {};
      // legacy global '1' means user dismissed existing promos — treat as empty map so new promos still show
      if (raw === '1') return {};
      const parsed = JSON.parse(raw);
      // If it's an array of ids, convert to map using current time as dismissed timestamp
      if (Array.isArray(parsed)) {
        const now = Date.now();
        const map = {};
        parsed.forEach(id => { map[id] = now; });
        return map;
      }
      // If it's already an object map, validate and return
      if (parsed && typeof parsed === 'object') return parsed;
      return {};
    } catch (e) {
      return {};
    }
  });

  // no undo feature: dismissals are persisted and not reversible from the UI

  useEffect(() => {
    let mounted = true;
    fetch('/api/promotions')
      .then((r) => r.json())
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          // hide any promo that has been dismissed (presence in dismissedMap)
          const filtered = data.filter(d => {
            const id = d.id;
            const dismissed = dismissedMap && dismissedMap[id];
            if (dismissed) return false; // explicitly hidden
            return true;
          }).slice(0, 6);
          setItems(filtered);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [dismissedMap]);

  if (items.length === 0) return null;

  return (
    <div className="bg-slate-900 border-b border-purple-900/20 px-4 py-3">
      <div className="max-w-7xl mx-auto relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-2">
          {items.map((it) => (
            <div key={it.id} className="bg-slate-800/70 border border-slate-700 rounded-lg p-3 hover:scale-[1.01] transition-transform flex gap-4 items-center">
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="flex gap-4 items-center w-full">
                <div className="w-28 h-20 sm:w-36 sm:h-28 bg-slate-900 rounded overflow-hidden flex items-center justify-center flex-none">
                  {it.image ? (
                    <img
                      src={it.image}
                      alt=""
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      srcSet={buildSrcSet(it.image) || undefined}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-800" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-white truncate">{it.title}</div>
                  <div className="text-sm text-gray-300 mt-1 line-clamp-2">{it.description}</div>
                </div>
              </a>
              <div className="flex-none pl-2">
                <button
                  onClick={() => {
                    const nextMap = { ...(dismissedMap || {}), [it.id]: true };
                    setDismissedMap(nextMap);
                    try { localStorage.setItem('promotions:dismissed', JSON.stringify(nextMap)); } catch {}
                    setItems((s) => s.filter(x => x.id !== it.id));
                  }}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
