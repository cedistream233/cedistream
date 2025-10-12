import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Purchase } from '@/entities/Purchase';

export default function PurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

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
      } catch (e) {
        setError(e.message || 'Verification failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [reference]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-4">Purchase Confirmation</h1>
      {loading && <p className="text-gray-300">Verifying your payment…</p>}
      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded p-4 text-red-100">
          <p>{error}</p>
          <button className="mt-3 underline" onClick={() => navigate('/')}>Go home</button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="bg-slate-900/60 border border-slate-700 rounded p-6">
          <p className="text-green-300 font-semibold">Payment verified ✅</p>
          <p className="mt-2 text-gray-200">Reference: <span className="font-mono text-sm text-gray-100">{reference}</span></p>
          <div className="mt-4 text-white">
            <h3 className="font-semibold">Items</h3>
            <ul className="mt-2 list-disc list-inside text-sm text-gray-200">
              {Array.isArray(data?.metadata?.items) ? data.metadata.items.map((it, idx) => (
                <li key={idx}>{it.item_title || it.item_id} — GH₵ {Number(it.amount || it?.amount).toFixed(2)}</li>
              )) : <li>No item data</li>}
            </ul>
            <div className="mt-4">
              <p className="text-sm text-gray-400">Creator receives ~80% of the sale. Platform net after Paystack fee is ~18%.</p>
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
