import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat } from 'lucide-react';

// loopMode: 'off' | 'one' | 'all'
export default function AudioPlayer({
  src,
  title = 'Audio',
  showPreviewBadge = false,
  onEnded,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  loopMode = 'off',
  onLoopModeChange,
  embedded = false,
  className = ''
  , loading = false
}) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    const el = new Audio();
    audioRef.current = el;
    el.preload = 'metadata';
  const onLoaded = () => { setDuration(el.duration || 0); setAudioLoading(false); };
    const onTime = () => { if (!seeking) setCurrent(el.currentTime || 0); };
    const onEnd = () => { setPlaying(false); setCurrent(0); onEnded && onEnded(); };
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => {
      el.pause();
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    const wasPlaying = playing;
    audioRef.current.src = src || '';
    // when src changes, start loading metadata
    if (src) {
      try { setAudioLoading(true); } catch (e) {}
      try { audioRef.current.load(); } catch (e) {}
    } else {
      // if there is no src, preserve external loading prop
      if (!loading) setAudioLoading(false);
    }
    // Apply loop for single-track loop mode
    audioRef.current.loop = loopMode === 'one';
    if (wasPlaying && src) {
      audioRef.current.play().catch(()=>{});
    } else {
      setPlaying(false);
      setCurrent(0);
    }
  }, [src, loopMode]);

  const toggle = async () => {
    const el = audioRef.current; if (!el || !src || audioLoading || loading) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { try { await el.play(); setPlaying(true); } catch {} }
  };
  const format = (t) => {
    if (!isFinite(t)) return '0:00';
    const m = Math.floor(t/60); const s = Math.floor(t%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  };
  const onSeek = (e) => {
    const v = Number(e.target.value);
    setCurrent(v); setSeeking(true);
  };
  const onSeekEnd = () => {
    const el = audioRef.current; if (!el) return;
    el.currentTime = current; setSeeking(false);
    if (playing) el.play().catch(()=>{});
  };
  const cycleLoop = () => {
    if (!onLoopModeChange) return;
    const next = loopMode === 'off' ? 'one' : loopMode === 'one' ? 'all' : 'off';
    onLoopModeChange(next);
  };

  return (
    <div
      className={
        `${embedded
          ? 'w-full relative'
          : 'w-[92vw] max-w-[480px] sm:max-w-[640px] mx-auto rounded-xl bg-slate-900/70 border border-slate-800 p-4 sm:p-5 relative shadow-lg'
        } ${className}`
      }
    >
      {showPreviewBadge && (
        <div className="absolute -top-2 right-3 text-[10px] uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded">Preview</div>
      )}
      <div className="flex flex-col items-center gap-3">
        <div className="w-full">
          <div className="flex items-center justify-center mb-2">
        <div className={`flex items-end gap-[3px] ${playing? 'opacity-100':'opacity-50'}`} aria-hidden>
              {([6,9,13,8,14,7,12,10,15,9,13,8]).map((h,i)=> (
                <span
                  key={i}
                  className="w-1.5 rounded-t origin-bottom bg-gradient-to-t from-green-600 to-emerald-300"
                  style={{
                    height: `${h}px`,
                    animation: playing ? `eqGrow ${0.8 + (i%5)*0.12}s infinite ease-in-out alternate` : 'none',
                    animationDelay: `${(i%6)*0.05}s`
                  }}
                />
              ))}
            </div>
          </div>
          <div className="text-center text-white font-semibold text-base sm:text-lg mb-1 line-clamp-1">{title}</div>
          <input type="range" min={0} max={isFinite(duration)? duration : 0} step={0.1}
            value={current}
            onChange={onSeek}
            onMouseUp={onSeekEnd}
            onTouchEnd={onSeekEnd}
            className="w-full accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{format(current)}</span>
            <span>{format(duration)}</span>
          </div>
        </div>

          <div className="flex items-center justify-center gap-4 mt-1">
          <button onClick={onPrev} disabled={!hasPrev} className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700 disabled:opacity-40" title="Previous">
            <SkipBack className="w-4 h-4"/>
          </button>
          <div className="relative">
            <button onClick={toggle} disabled={(audioLoading || loading) || !src} className={`w-12 h-12 rounded-full ${(audioLoading || loading) ? 'bg-slate-600/60 text-white/60' : 'bg-white text-slate-900'} flex items-center justify-center shadow-md`} aria-label={(audioLoading || loading) ? 'Loading audio' : 'Play/Pause'}>
              {playing ? <Pause className="w-6 h-6"/> : <Play className="w-6 h-6 ml-0.5"/>}
            </button>
            {(audioLoading || loading) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button onClick={onNext} disabled={!hasNext} className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700 disabled:opacity-40" title="Next">
            <SkipForward className="w-4 h-4"/>
          </button>
          {onLoopModeChange && (
            <button onClick={cycleLoop} className={`w-10 h-10 rounded-full flex items-center justify-center border border-slate-700 ${
              loopMode==='off' ? 'bg-slate-800 text-white' : loopMode==='one' ? 'bg-purple-600 text-white' : 'bg-pink-600 text-white'
            }`} title={loopMode==='off'?'Loop off': loopMode==='one'?'Loop current':'Loop all'}>
              <div className="relative">
                <Repeat className="w-4 h-4"/>
                {loopMode==='one' && <span className="absolute -top-1 -right-1 text-[10px] font-bold">1</span>}
              </div>
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes eqGrow { from { transform: scaleY(0.4); } to { transform: scaleY(1.6); } }
      `}</style>
    </div>
  );
}
