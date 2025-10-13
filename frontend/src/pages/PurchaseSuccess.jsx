import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Purchase } from '@/entities/Purchase';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Sparkles } from 'lucide-react';
import { Leaderboard } from '@/utils';

export default function PurchaseSuccess() {
  const { updateMyUserData } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [top5, setTop5] = useState([]);
  const [myRank, setMyRank] = useState(null);

  const reference = searchParams.get('reference') || searchParams.get('ref');

  useEffect(() => {
    if (!reference) {
      setError('No reference provided');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const resp = await Purchase.verify(reference);
        setData(resp.data || resp);
        // remove purchased items from local cart
        try {
          const items = (resp?.data?.metadata?.items || resp?.metadata?.items || []);
          const raw = localStorage.getItem('user') || localStorage.getItem('demo_user');
          const u = raw ? JSON.parse(raw) : null;
          if (u && Array.isArray(u.cart)) {
            const bought = new Set(items.map(it => `${it.item_type}:${it.item_id}`));
            const nextCart = u.cart.filter(ci => !bought.has(`${ci.item_type}:${ci.item_id}`));
            const updated = { ...u, cart: nextCart, last_checkout_ref: undefined };
            localStorage.setItem('user', JSON.stringify(updated));
            localStorage.setItem('demo_user', JSON.stringify(updated));
            // also update context so header/cart icon reacts immediately
            try { await updateMyUserData({ cart: nextCart, last_checkout_ref: undefined }); } catch {}
          }
        } catch {}
        // try to load top 5 and rank using returned metadata
        const items = (resp?.data?.metadata?.items || resp?.metadata?.items || [])
          .filter(it => it?.item_id && it?.item_type);
        if (items.length > 0) {
          const first = items[0];
          try {
            const [leaders, rank] = await Promise.all([
              Leaderboard.topN(first.item_type, first.item_id, 5),
              Leaderboard.rank(first.item_type, first.item_id)
            ]);
            setTop5(Array.isArray(leaders) ? leaders : []);
            setMyRank(rank?.rank ?? null);
          } catch {}
        }
      } catch (e) {
        setError(e.message || 'Verification failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [reference]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-4">Thanks for your support!</h1>
      {loading && <p className="text-gray-300">Verifying your payment…</p>}
      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded p-4 text-red-100">
          <p>{error}</p>
          <button className="mt-3 underline" onClick={() => navigate('/')}>Go home</button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/60 border border-purple-900/30 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-yellow-300" />
            <p className="text-green-300 font-semibold">Payment verified</p>
          </div>
          <p className="mt-2 text-gray-200">Ref: <span className="font-mono text-sm text-gray-100">{reference}</span></p>

          <div className="mt-4 grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-white">Your Items</h3>
              <ul className="mt-2 space-y-2">
                {Array.isArray(data?.metadata?.items) ? data.metadata.items.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm text-gray-200">
                    <span className="truncate mr-2">{it.item_title || it.item_id}</span>
                    <span className="text-yellow-400 font-semibold">GH₵ {Number(it.amount || it?.amount).toFixed(2)}</span>
                  </li>
                )) : <li className="text-sm text-gray-400">No item data</li>}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 text-white font-semibold">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Top Supporters
              </div>
              {top5.length === 0 ? (
                <p className="text-sm text-gray-400 mt-2">Leaderboard data will update shortly.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {top5.map((u, idx) => (
                    <li key={u.user_id || idx} className="flex items-center justify-between text-gray-200">
                      <span className="truncate">
                        #{idx + 1} — {u.name || 'Supporter'}
                      </span>
                      <span className="text-yellow-400 font-medium">GH₵ {Number(u.total_amount || 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {myRank && (
                <p className="mt-3 text-sm text-purple-200">You are currently ranked <span className="font-semibold">#{myRank}</span> for this item. Keep supporting to climb the ranks!</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="px-4 py-2 bg-purple-600 rounded text-white" onClick={() => navigate('/library')}>Go to My Library</button>
            <button className="px-4 py-2 bg-slate-800 rounded text-white" onClick={() => navigate('/')}>Continue browsing</button>
          </div>
        </div>
      )}
    </div>
  );
}
