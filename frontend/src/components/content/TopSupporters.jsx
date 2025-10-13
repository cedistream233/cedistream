import React, { useEffect, useState } from 'react';
import { useImageViewer } from '@/contexts/ImageViewerContext';
import { Trophy, Medal, Award } from 'lucide-react';

export default function TopSupporters({ itemType, itemId, className = '' }) {
  const [supporters, setSupporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const { open: openViewer } = useImageViewer();
  const PLATFORM_SHARE = 0.8; // Creator's share when backend doesn't provide net fields

  useEffect(() => {
    if (!itemType || !itemId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/leaderboard/${itemType}/${itemId}`);
        if (res.ok) {
          const data = await res.json();
          setSupporters(data || []);
        }
      } catch (e) {
        console.error('Failed to load leaderboard', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [itemType, itemId]);

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-slate-900/60 to-slate-800/60 border border-purple-900/30 rounded-xl p-4 sm:p-6 ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Top Supporters</h3>
          </div>
          <button className="text-sm text-gray-400" onClick={() => setCollapsed(c => !c)}>{collapsed ? 'Expand' : 'Collapse'}</button>
        </div>
        {!collapsed && (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-slate-700/40 rounded-lg"></div>
            <div className="h-16 bg-slate-700/40 rounded-lg"></div>
            <div className="h-16 bg-slate-700/40 rounded-lg"></div>
          </div>
        )}
      </div>
    );
  }

  if (!supporters.length) {
    return (
      <div className={`bg-gradient-to-br from-slate-900/60 to-slate-800/60 border border-purple-900/30 rounded-xl p-4 sm:p-6 ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Top Supporters</h3>
          </div>
          <button className="text-sm text-gray-400" onClick={() => setCollapsed(c => !c)}>{collapsed ? 'Expand' : 'Collapse'}</button>
        </div>
        {!collapsed && (
          <p className="text-sm text-gray-400 text-center py-6">
            Be the first to support this content and claim the #1 spot!
          </p>
        )}
      </div>
    );
  }

  const getRankIcon = (index) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />;
      case 1:
        return <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />;
      case 2:
        return <Award className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankGradient = (index) => {
    switch (index) {
      case 0:
        return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30';
      case 1:
        return 'from-gray-400/20 to-gray-500/10 border-gray-400/30';
      case 2:
        return 'from-amber-600/20 to-amber-700/10 border-amber-600/30';
      default:
        return 'from-slate-700/20 to-slate-800/10 border-slate-600/30';
    }
  };

  // Compute creator net points from a supporter record; prefer creator/net fields when available
  const getNetPoints = (supporter) => {
    try {
      const gross = Number(supporter?.total_amount ?? supporter?.amount ?? 0) || 0;
      const candidates = [
        supporter?.creator_total_amount,
        supporter?.creator_amount,
        supporter?.creator_revenue,
        supporter?.creatorNet,
      ];
      const firstDefined = candidates.find(v => typeof v !== 'undefined' && v !== null);
      const net = Number(firstDefined);
      if (!isNaN(net)) return net;
      return gross * PLATFORM_SHARE;
    } catch {
      return 0;
    }
  };

  return (
    <div className={`bg-gradient-to-br from-slate-900/60 to-slate-800/60 border border-purple-900/30 rounded-xl p-4 sm:p-6 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Top Supporters</h3>
        </div>
        <button className="text-sm text-gray-400" onClick={() => setCollapsed(c => !c)}>{collapsed ? 'Expand' : 'Collapse'}</button>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {supporters.map((supporter, index) => (
            <div
              key={supporter.user_id || index}
              role={supporter.profile_image ? 'button' : undefined}
              tabIndex={supporter.profile_image ? 0 : undefined}
              onKeyDown={supporter.profile_image ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(supporter.profile_image); } } : undefined}
              onClick={(e) => { e.stopPropagation(); if (supporter.profile_image) openViewer(supporter.profile_image); }}
              className={`relative bg-gradient-to-r ${getRankGradient(index)} border rounded-lg p-3 sm:p-4 transition-all hover:scale-[1.02] hover:shadow-lg ${supporter.profile_image ? 'cursor-zoom-in' : ''}`}
            >
              <div className="flex items-center gap-3">
                {/* Rank Icon */}
                <div className="flex-shrink-0">
                  {getRankIcon(index)}
                </div>

                {/* Avatar */}
                <div className="flex-shrink-0">
                  {supporter.profile_image ? (
                    <img
                      src={supporter.profile_image}
                      alt={supporter.name}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white/10 cursor-zoom-in"
                      onClick={(e) => { e.stopPropagation(); if (supporter.profile_image) openViewer(supporter.profile_image); }}
                    />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-white/10">
                      <span className="text-white font-bold text-sm sm:text-base">
                        {supporter.name?.[0]?.toUpperCase() || 'A'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name and Stats */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm sm:text-base truncate">
                    {supporter.name || 'Anonymous'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {supporter.purchase_count} {supporter.purchase_count === 1 ? 'purchase' : 'purchases'}
                  </p>
                </div>

                {/* Points (no currency) */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-yellow-400 font-bold text-sm sm:text-base">
                    {(() => {
                      const v = Number(getNetPoints(supporter) || 0);
                      // Show up to 2 decimals, but do not force rounding up beyond representation
                      return `${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} pts`;
                    })()}
                  </p>
                  <p className="text-xs text-gray-500">net</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {supporters.length < 3 && !collapsed && (
        <p className="text-xs text-gray-500 text-center mt-4">
          {3 - supporters.length} {supporters.length === 2 ? 'spot' : 'spots'} available on the leaderboard
        </p>
      )}
    </div>
  );
}
