import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PurchasedVideoRow({ video }) {
  const navigate = useNavigate();
  const image = video?.thumbnail || null;
  const title = video?.title || 'Untitled';
  const creator = video?.creator || '—';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/videos/${encodeURIComponent(video.id)}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/videos/${encodeURIComponent(video.id)}`); } }}
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
          <div className="text-xs text-gray-400 truncate">{creator}</div>
          <div className="text-[11px] text-green-400 mt-0.5">Purchased</div>
        </div>
      </div>
      <div className="pl-3 flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/videos/${encodeURIComponent(video.id)}`); }}
          className="px-3 py-1.5 rounded-md bg-slate-800 text-white text-sm hover:bg-slate-700"
        >
          Open
        </button>
      </div>
    </div>
  );
}
