import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2 } from 'lucide-react';

export default function VideoPlayer({ src, poster, title='Video', showPreviewBadge=false }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const onLoaded = () => setDuration(v.duration || 0);
    const onTime = () => setCurrent(v.currentTime || 0);
    const onEnd = () => setPlaying(false);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
    };
  }, []);

  useEffect(() => { setPlaying(false); setCurrent(0); }, [src]);

  const toggle = async () => {
    const v = ref.current; if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { try { await v.play(); setPlaying(true); } catch {} }
  };
  const format = (t) => {
    if (!isFinite(t)) return '0:00';
    const m = Math.floor(t/60); const s = Math.floor(t%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  };
  const seek = (e) => { const v = ref.current; if (!v) return; v.currentTime = Number(e.target.value); };
  const replay = () => { const v = ref.current; if (!v) return; v.currentTime = 0; v.play().catch(()=>{}); setPlaying(true); };
  const toggleMute = () => { const v = ref.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); };
  const fullscreen = () => { const v = ref.current?.parentElement; if (!v) return; if (v.requestFullscreen) v.requestFullscreen(); };

  return (
    <div className="relative bg-black rounded-xl overflow-hidden">
      <video ref={ref} src={src || undefined} poster={poster} className="w-full h-auto" />
      {showPreviewBadge && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded">Preview</div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="w-9 h-9 rounded-full bg-white text-slate-900 flex items-center justify-center">
            {playing ? <Pause className="w-5 h-5"/> : <Play className="w-5 h-5 ml-0.5"/>}
          </button>
          <input type="range" min={0} max={isFinite(duration)? duration:0} value={current} step={0.1} onChange={seek} className="flex-1 accent-purple-500" />
          <div className="text-xs text-white/90 w-16 text-right">{format(current)} / {format(duration)}</div>
          <button onClick={replay} className="w-9 h-9 rounded bg-white/10 text-white flex items-center justify-center"><RotateCcw className="w-4 h-4"/></button>
          <button onClick={toggleMute} className="w-9 h-9 rounded bg-white/10 text-white flex items-center justify-center">{muted? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}</button>
          <button onClick={fullscreen} className="w-9 h-9 rounded bg-white/10 text-white flex items-center justify-center"><Maximize2 className="w-4 h-4"/></button>
        </div>
      </div>
    </div>
  );
}
