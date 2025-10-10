import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

export default function ContentRow({ item, type = 'song', onAddToCart, onViewDetails }) {
  const image = item.cover_image || item.thumbnail || null;
  const title = item.title;
  const creator = item.artist || item.creator;
  const price = item.price;
  const [owned, setOwned] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('demo_user') || 'null');
      if (u && Array.isArray(u.purchases)) {
        setOwned(u.purchases.some(p => p.item_id === item.id));
      } else setOwned(false);
    } catch { setOwned(false); }
  }, [item?.id]);

  return (
    <div
      onClick={onViewDetails}
      className="group flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-purple-900/20 hover:bg-slate-900/70 transition cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 rounded-md overflow-hidden shrink-0">
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-white font-medium truncate">{title}</div>
            {!owned && (
              <div className="text-[11px] text-red-500 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span className="uppercase">Locked</span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400 truncate">{creator}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Pay what you want • Min GH₵ {parseFloat(price)?.toFixed(2) || '0.00'}</div>
        </div>
      </div>
      <div className="pl-3 flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onViewDetails && onViewDetails(); }}
          className="px-3 py-2 rounded-md bg-slate-800 text-gray-200 text-sm hover:bg-slate-700"
        >
          Preview
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCart && onAddToCart(); }}
          className="px-3 py-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:from-purple-700 hover:to-pink-700"
        >
          Buy
        </button>
      </div>
    </div>
  );
}
