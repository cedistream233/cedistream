import React from 'react';
import { setPostAuthIntent } from '@/utils';

// Generic row-style renderer that matches the Library's Purchased*Row components:
// small 56x56-ish thumbnail on the left, compact text, and a right-side action button.
export default function ContentRow({ item, type = 'song', onAddToCart, onViewDetails, showPwyw = true, noCard = false }) {
  const image = item?.cover_image || item?.thumbnail || null;
  const title = item?.title || item?.name || 'Untitled';
  // Don't show a fallback dash when artist/creator is missing — keep it empty
  const artist = item?.artist || item?.creator || item?.uploader || '';
  const price = item?.price || 0;
  const owned = Boolean(item?.owned_by_me);

  const handleView = (e) => {
    if (e) e.stopPropagation();
    if (onViewDetails) return onViewDetails();
    // fallback: navigate by type
  if (type === 'song') window.location.href = `/songs/${encodeURIComponent(item.id)}`;
  else if (type === 'album') window.location.href = `/albums/${encodeURIComponent(item.id)}`;
  else if (type === 'video') window.location.href = `/videos/${encodeURIComponent(item.id)}`;
  };

  const handleAdd = (e) => {
    if (e) e.stopPropagation();
    if (onAddToCart) return onAddToCart();

    const token = localStorage.getItem('token');
    if (!token) {
      try {
        setPostAuthIntent({
          action: 'add-to-cart',
          item: { item_type: type, item_id: item.id, title, price: Number(price || 0), min_price: Number(price || 0), image },
          redirect: '/cart'
        });
      } catch {}
      window.location.href = '/signup';
      return;
    }

    // Authenticated fallback: add to local demo cart and redirect to cart
    try {
      const uRaw = localStorage.getItem('user');
      const u = uRaw ? JSON.parse(uRaw) : {};
      const cart = Array.isArray(u.cart) ? u.cart : [];
      const exists = cart.some(i => i.item_id === item.id && i.item_type === type);
      if (!exists) {
        const next = { ...u, cart: [...cart, { item_type: type, item_id: item.id, title, price: Number(price || 0), min_price: Number(price || 0), image }] };
        try { localStorage.setItem('demo_user', JSON.stringify(next)); } catch {}
        try { localStorage.setItem('user', JSON.stringify(next)); } catch {}
      }
    } catch {}
    window.location.href = '/cart';
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleView}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleView(); } }}
      className="group flex items-center justify-between py-2 px-0 transition-colors cursor-pointer"
    >
      {noCard ? (
        // Render raw row (no rounded card) — used when rows are grouped in a single rounded container
        <div className="flex items-center justify-between w-full p-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative overflow-hidden shrink-0 w-28 h-16 sm:w-36 sm:h-20 md:w-48 md:h-28 rounded-sm bg-slate-800">
              {image ? (
                <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-sm md:text-base text-white font-medium truncate">{title}</div>
              {artist ? <div className="text-xs text-gray-400 truncate">{artist}</div> : null}
              {owned ? (
                <div className="text-[11px] text-green-400 mt-0.5">Purchased</div>
              ) : (
                <div className="text-[11px] text-gray-300 mt-0.5">{showPwyw ? `Pay what you want • Min GH₵ ${Number(price || 0).toFixed(2)}` : `Min GH₵ ${Number(price || 0).toFixed(2)}`}</div>
              )}
            </div>
          </div>

          <div className="pl-3 flex items-center gap-2">
            {owned ? (
              <button
                onClick={(e) => { e.stopPropagation(); if (type === 'song') window.location.href = `/songs/${encodeURIComponent(item.id)}?autoplay=1`; else if (type === 'album') window.location.href = `/albums/${encodeURIComponent(item.id)}`; else if (type === 'video') window.location.href = `/videos/${encodeURIComponent(item.id)}`; }}
                className="px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:from-purple-700 hover:to-pink-700"
              >
                {type === 'song' || type === 'video' ? 'Play' : 'Open'}
              </button>
            ) : (
              <button
                onClick={handleAdd}
                className="px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:from-purple-700 hover:to-pink-700"
              >
                Buy
              </button>
            )}
          </div>
        </div>
      ) : (
        // Default: each row is its own rounded card (existing behavior)
        <div className="w-full p-0">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-purple-900/20 hover:bg-slate-900/70 transition">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative overflow-hidden shrink-0 w-28 h-16 sm:w-36 sm:h-20 md:w-48 md:h-28 rounded-sm bg-slate-800">
                {image ? (
                  <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900" />
                )}
              </div>

              <div className="min-w-0">
                <div className="text-sm md:text-base text-white font-medium truncate">{title}</div>
                {artist ? <div className="text-xs text-gray-400 truncate">{artist}</div> : null}
                {owned ? (
                  <div className="text-[11px] text-green-400 mt-0.5">Purchased</div>
                ) : (
                  <div className="text-[11px] text-gray-300 mt-0.5">{showPwyw ? `Pay what you want • Min GH₵ ${Number(price || 0).toFixed(2)}` : `Min GH₵ ${Number(price || 0).toFixed(2)}`}</div>
                )}
              </div>
            </div>

            <div className="pl-3 flex items-center gap-2">
              {owned ? (
                <button
                  onClick={(e) => { e.stopPropagation(); if (type === 'song') window.location.href = `/songs/${encodeURIComponent(item.id)}?autoplay=1`; else if (type === 'album') window.location.href = `/albums/${encodeURIComponent(item.id)}`; else if (type === 'video') window.location.href = `/videos/${encodeURIComponent(item.id)}`; }}
                  className="px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:from-purple-700 hover:to-pink-700"
                >
                  {type === 'song' || type === 'video' ? 'Play' : 'Open'}
                </button>
              ) : (
                <button
                  onClick={handleAdd}
                  className="px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:from-purple-700 hover:to-pink-700"
                >
                  Buy
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
