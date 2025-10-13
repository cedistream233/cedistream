import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PurchasedSongRow({ song }) {
  const navigate = useNavigate();
  const image = song?.cover_image || null;
  const title = song?.title || 'Untitled';
  const artist = song?.artist || '—';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/songs/${encodeURIComponent(song.id)}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/songs/${encodeURIComponent(song.id)}`); } }}
      className="group flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-purple-900/20 hover:bg-slate-900/70 transition cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-14 h-14 rounded-md overflow-hidden shrink-0">
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-white font-medium truncate">{title}</div>
          <div className="text-xs text-gray-400 truncate">{artist}</div>
          <div className="text-[11px] text-green-400 mt-0.5">Purchased</div>
        </div>
      </div>
      <div className="pl-3 flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/songs/${encodeURIComponent(song.id)}?autoplay=1`); }}
          className="px-3 py-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm hover:from-purple-700 hover:to-pink-700"
        >
          Play
        </button>
      </div>
    </div>
  );
}
