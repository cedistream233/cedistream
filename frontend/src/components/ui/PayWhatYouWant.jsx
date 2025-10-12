import React from 'react';

export default function PayWhatYouWant({ minPrice = 1, onAdd, className = '' }) {
  const min = Number(minPrice || 1) || 1;
  return (
    <div className={`bg-slate-900/50 border border-purple-900/20 rounded-lg p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-gray-300">Pay What You Want</div>
          <div className="text-lg sm:text-xl font-semibold text-white">Minimum GH₵ {min.toFixed(2)}</div>
          {/* no supporter-facing earnings text */}
          <div className="text-xs text-gray-500 mt-2">Top supporters appear on the content’s leaderboard.</div>
        </div>

        <div className="w-full sm:w-auto">
          <button
            onClick={onAdd}
            className="w-full md:w-auto px-5 md:px-7 py-3 md:py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium flex items-center justify-center"
          >
            <span>Add to Cart</span>
          </button>
        </div>
      </div>
    </div>
  );
}
