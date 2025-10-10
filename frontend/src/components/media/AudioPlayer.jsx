import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, Repeat } from 'lucide-react';

export default function AudioPlayer({ src, title = 'Audio', showPreviewBadge = false, onEnded }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    const el = new Audio();
    audioRef.current = el;
    el.preload = 'metadata';
    const onLoaded = () => setDuration(el.duration || 0);
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
    if (wasPlaying && src) {
      audioRef.current.play().catch(()=>{});
    } else {
      setPlaying(false);
      setCurrent(0);
    }
  }, [src]);

  const toggle = async () => {
    const el = audioRef.current; if (!el || !src) return;
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
  const replay = () => {
    const el = audioRef.current; if (!el) return;
    el.currentTime = 0; el.play().catch(()=>{}); setPlaying(true);
  };
  const skip = (sec) => {
    const el = audioRef.current; if (!el) return;
    el.currentTime = Math.max(0, Math.min((el.currentTime||0) + sec, duration||0));
  };
  const toggleLoop = () => {
    const el = audioRef.current; if (!el) return;
    el.loop = !el.loop; setLoop(el.loop);
  };

  return (
    <div className="w-full rounded-lg bg-slate-900/60 border border-slate-800 p-4 relative">
      {showPreviewBadge && (
        <div className="absolute -top-2 right-3 text-[10px] uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded">Preview</div>
      )}
      <div className="flex items-center gap-3">
        <div className={`flex items-end gap-0.5 mr-2 ${playing? 'opacity-100':'opacity-50'}`} aria-hidden>
          {[6,10,7,12,8].map((h,i)=> (
            <span key={i} className="w-1.5 bg-purple-500 rounded-t origin-bottom"
              style={{ height: `${h}px`, animation: playing? `barBeat ${0.9 + i*0.05}s infinite ease-in-out alternate`: 'none' }} />
          ))}
        </div>
        <button onClick={()=>skip(-10)} className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700" title="Back 10s">
          <SkipBack className="w-4 h-4"/>
        </button>
        <button onClick={toggle} className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center">
          {playing ? <Pause className="w-5 h-5"/> : <Play className="w-5 h-5 ml-0.5"/>}
        </button>
        <button onClick={()=>skip(10)} className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700" title="Forward 10s">
          <SkipForward className="w-4 h-4"/>
        </button>
        <div className="flex-1">
          <div className="text-sm text-white/90 mb-2 line-clamp-1">{title}</div>
          <input type="range" min={0} max={isFinite(duration)? duration : 0} step={0.1}
            value={current}
            onChange={onSeek}
            onMouseUp={onSeekEnd}
            onTouchEnd={onSeekEnd}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{format(current)}</span>
            <span>{format(duration)}</span>
          </div>
        </div>
        <button onClick={replay} className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700" title="Replay">
          <RotateCcw className="w-5 h-5"/>
        </button>
        <button onClick={toggleLoop} className={`w-10 h-10 rounded-full ${loop? 'bg-purple-600 text-white':'bg-slate-800 text-white'} flex items-center justify-center border border-slate-700`} title="Loop">
          <Repeat className="w-5 h-5"/>
        </button>
      </div>
      <style>{`
        @keyframes barBeat { from { transform: scaleY(0.4); } to { transform: scaleY(1.4); } }
      `}</style>
    </div>
  );
}
