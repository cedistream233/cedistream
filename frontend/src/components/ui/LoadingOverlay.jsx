import React from 'react';

export default function LoadingOverlay({ className = '', text = 'Loading' }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${className}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        <div className="text-white text-sm opacity-90">{text}…</div>
      </div>
    </div>
  );
}
