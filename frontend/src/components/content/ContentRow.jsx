import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';
import { setPostAuthIntent } from '@/utils';

export default function ContentRow({ item, type = 'song', onAddToCart, onViewDetails, showPwyw = true }) {
  const image = item.cover_image || item.thumbnail || null;
  const title = item.title;
  const creator = item.artist || item.creator;
  const price = item.price;
  const [owned, setOwned] = useState(false);
  // Optimistically show preview if metadata suggests it; null = unknown
  const [hasPreview, setHasPreview] = useState(() => {
    if (!item) return null;
    return !!item.preview_url ? true : null;
  });
  const { updateMyUserData, user } = useAuth();

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('demo_user') || 'null');
      if (u && Array.isArray(u.purchases)) {
        setOwned(u.purchases.some(p => p.item_id === item.id));
      } else setOwned(false);
    } catch { setOwned(false); }
  }, [item?.id]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!item?.id) { setHasPreview(false); return; }
      // If metadata contains preview_url for any type, we are done
      if (item.preview_url) { setHasPreview(true); return; }

      try {
        if (type === 'song') {
          const res = await fetch(`/api/media/song/${encodeURIComponent(item.id)}/preview`);
          if (!aborted) {
            if (res.ok) {
              const d = await res.json();
              setHasPreview(!!d?.url);
            } else {
              setHasPreview(false);
            }
          }
        } else if (type === 'video') {
          const res = await fetch(`/api/media/video/${encodeURIComponent(item.id)}/preview`);
          if (!aborted) {
            if (res.ok) {
              const d = await res.json();
              setHasPreview(!!d?.url);
            } else {
              setHasPreview(false);
            }
          }
        } else {
          setHasPreview(false);
        }
      } catch {
        if (!aborted) setHasPreview(false);
      }
    })();
    return () => { aborted = true; };
  }, [item?.id, type, item?.preview_url]);

  const getPublishedDate = () => {
    const raw = item?.release_date || item?.published_at || item?.published_date || item?.released_at || item?.created_at || item?.created_date;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const publishedDate = getPublishedDate();

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
          {/* Locked overlay: icon-only, always show when not owned (even if preview exists) */}
          {!owned && type === 'song' && (
            <div className="absolute top-1 left-1 p-1 rounded-full bg-black/60 border border-slate-700 text-gray-200">
              <Lock className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-white font-medium truncate">{title}</div>
          <div className="text-xs text-gray-400 truncate">{creator}</div>
          {publishedDate && <div className="text-xs text-gray-400 mt-0.5">Published {publishedDate}</div>}
          {showPwyw && (
            <div className="text-[11px] text-gray-400 mt-0.5">Pay what you want • Min GH₵ {parseFloat(price)?.toFixed(2) || '0.00'}</div>
          )}
        </div>
      </div>
      <div className="pl-3 flex items-center gap-2">
        {hasPreview !== false ? (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                // attempt to prefetch preview URL and store for immediate use on details page
                if (type === 'song') {
                  const res = await fetch(`/api/media/song/${encodeURIComponent(item.id)}/preview`);
                  if (res.ok) {
                    const d = await res.json();
                    if (d?.url) {
                      try { sessionStorage.setItem(`preview:${item.id}`, d.url); } catch {}
                    }
                  }
                } else if (type === 'video') {
                  const res = await fetch(`/api/media/video/${encodeURIComponent(item.id)}/preview`);
                  if (res.ok) {
                    const d = await res.json();
                    if (d?.url) {
                      try { sessionStorage.setItem(`preview:video:${item.id}`, d.url); } catch {}
                    }
                  }
                }
              } catch (err) {
                // ignore
              }
              // navigate to details; the details page will pick up sessionStorage preview if present
              if (type === 'video') window.location.href = `/videos?id=${encodeURIComponent(item.id)}`;
              else window.location.href = `/songs/${encodeURIComponent(item.id)}`;
            }}
            className="px-3 py-2 rounded-md bg-slate-800 text-gray-200 text-sm hover:bg-slate-700"
          >
            Preview
          </button>
        ) : null}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            try {
              // if onAddToCart callback is provided, call it (page-level handlers may implement custom flows)
              if (onAddToCart) return onAddToCart();

              // If not authenticated, store intent and go to signup
              const token = localStorage.getItem('token');
              if (!token) {
                const min = Number(price || 0);
                setPostAuthIntent({
                  action: 'add-to-cart',
                  item: {
                    item_type: type,
                    item_id: item.id,
                    title: title,
                    price: min,
                    min_price: min,
                    image: item.cover_image || item.thumbnail || null,
                  },
                  redirect: '/cart'
                });
                window.location.href = '/signup';
                return;
              }

              // construct cart item in the same shape other pages use
              const cartItem = {
                item_type: type,
                item_id: item.id,
                title: title,
                price: Number(price || 0),
                min_price: Number(price || 0),
                image: item.cover_image || item.thumbnail || null,
              };

              // use current cart from localStorage user if available
              const u = JSON.parse(localStorage.getItem('user') || 'null') || JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
              const currentCart = (u?.cart) || [];
              const exists = currentCart.some(i => i.item_id === item.id && i.item_type === type);
              if (!exists) {
                const updated = await (updateMyUserData ? updateMyUserData({ cart: [...currentCart, cartItem] }) : (async () => {
                  const next = { ...(u||{}), cart: [...currentCart, cartItem] };
                  localStorage.setItem('demo_user', JSON.stringify(next));
                  localStorage.setItem('user', JSON.stringify(next));
                  return next;
                })());
              }

              // navigate to cart for checkout
              window.location.href = '/cart';
            } catch (err) {
              console.error(err);
              // fallback: try a simple localStorage update and redirect
              try {
                const u = JSON.parse(localStorage.getItem('demo_user') || 'null') || {};
                u.cart = u.cart || [];
                if (!u.cart.some(i => i.item_id === item.id)) u.cart.push({ item_type: type, item_id: item.id, title, price: Number(price||0) });
                localStorage.setItem('demo_user', JSON.stringify(u));
                localStorage.setItem('user', JSON.stringify(u));
              } catch {}
              window.location.href = '/cart';
            }
          }}
          className="px-3 py-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:from-purple-700 hover:to-pink-700"
        >
          Buy
        </button>
      </div>
    </div>
  );
}
