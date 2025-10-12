import React from 'react';

export default function PayWhatYouWant({ minPrice = 1, onAdd, className = '' }) {
  const min = Number(minPrice || 1) || 1;
  return (
    <div className={`bg-slate-900/50 border border-purple-900/20 rounded-lg p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-gray-300">Pay What You Want</div>
          <div className="text-lg sm:text-xl font-semibold text-white">Minimum GH₵ {min.toFixed(2)}</div>
          <div className="text-sm text-gray-400 mt-1">Contribute any amount above the minimum.Your support helps creators make great content</div>
          <div className="text-xs text-gray-500 mt-2">Top supporters appear on the content’s leaderboard.</div>
        </div>

        <div className="w-full sm:w-auto">
          <button
            onClick={onAdd}
            className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 px-4 rounded-lg font-medium"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
