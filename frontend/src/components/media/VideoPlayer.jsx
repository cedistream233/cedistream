import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, SkipForward } from 'lucide-react';

export default function VideoPlayer({ src, poster, title='Video', showPreviewBadge=false }) {
  const ref = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const onLoaded = () => setDuration(v.duration || 0);
    const onTime = () => setCurrent(v.currentTime || 0);
    const onEnd = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onPlaying = () => setBuffering(false);
    
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('playing', onPlaying);
    
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('playing', onPlaying);
    };
  }, []);

  useEffect(() => {
    const v = ref.current; if (!v) return; setPlaying(false); setCurrent(0);
    try { v.load?.(); } catch {}
  }, [src]);

  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  function showControlsTemporarily() {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }

  const togglePlay = async () => { const v = ref.current; if (!v) return; if (playing) { v.pause(); setPlaying(false); } else { try { await v.play(); setPlaying(true); } catch {} } };
  const format = (t) => { if (!isFinite(t)) return '0:00'; const m = Math.floor(t/60); const s = Math.floor(t%60).toString().padStart(2,'0'); return `${m}:${s}`; };
  const onSeek = (e) => { const v = ref.current; if (!v) return; v.currentTime = Number(e.target.value); setCurrent(Number(e.target.value)); };
  const toggleMute = () => { const v = ref.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); };
  const enterFullscreen = () => { const el = containerRef.current; if (!el) return; if (el.requestFullscreen) el.requestFullscreen(); };
  const skip = (sec) => { const v = ref.current; if (!v) return; v.currentTime = Math.max(0, Math.min((v.currentTime||0)+sec, duration||0)); };

  const onContainerTap = (ev) => {
    const target = ev.target;
    // Don't toggle if clicking on controls
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
      showControlsTemporarily();
      return;
    }
    showControlsTemporarily();
    togglePlay();
  };

  const progressPercent = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div ref={containerRef} onClick={onContainerTap} className="relative bg-black rounded-xl overflow-hidden select-none group">
      <video
        ref={ref}
        src={src || undefined}
        poster={poster}
        className="w-full h-auto block"
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        controlsList="nodownload"
        autoBuffer="true"
      />

      {showPreviewBadge && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded z-20">Preview</div>
      )}

      {/* Buffering indicator */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/30">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      )}

      {/* YouTube-style center play overlay (only when paused) */}
      {!playing && !buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <button 
            aria-label="play"
            className="pointer-events-auto w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-2xl transition-all" 
            onClick={(e)=>{ e.stopPropagation(); togglePlay(); }}
          >
            <Play className="w-10 h-10 md:w-12 md:h-12 text-black fill-black ml-1" />
          </button>
        </div>
      )}

      {/* YouTube-style bottom controls */}
      <div className={`absolute left-0 right-0 bottom-0 transition-opacity duration-200 ${controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Progress bar - full width above controls */}
        <div className="relative w-full h-1 bg-white/30 group/progress cursor-pointer" onClick={(e)=>{ e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; const pct = x / rect.width; const v = ref.current; if (v && duration > 0) { v.currentTime = pct * duration; setCurrent(pct * duration); } showControlsTemporarily(); }}>
          <div className="absolute left-0 top-0 h-full bg-purple-500 transition-all" style={{ width: `${progressPercent}%` }}></div>
          <div className="absolute top-0 h-full w-3 bg-purple-500 rounded-full transform -translate-x-1/2 opacity-0 group-hover/progress:opacity-100 transition-opacity" style={{ left: `${progressPercent}%` }}></div>
        </div>

        {/* Control buttons and time */}
        <div className="bg-gradient-to-t from-black/80 to-transparent px-2 py-2 md:px-4 md:py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Play/Pause */}
            <div className="flex items-center gap-2">
              <button aria-label={playing ? 'pause' : 'play'} onClick={(e)=>{ e.stopPropagation(); togglePlay(); showControlsTemporarily(); }} className="text-white hover:text-white/80 transition-colors">
                {playing ? <Pause className="w-7 h-7 md:w-8 md:h-8"/> : <Play className="w-7 h-7 md:w-8 md:h-8"/>}
              </button>
              
              {/* Skip buttons - hidden on very small screens */}
              <button aria-label="skip back" onClick={(e)=>{ e.stopPropagation(); skip(-10); showControlsTemporarily(); }} className="hidden sm:block text-white hover:text-white/80 transition-colors">
                <SkipBack className="w-6 h-6" />
              </button>
              <button aria-label="skip forward" onClick={(e)=>{ e.stopPropagation(); skip(10); showControlsTemporarily(); }} className="hidden sm:block text-white hover:text-white/80 transition-colors">
                <SkipForward className="w-6 h-6" />
              </button>

              {/* Time display */}
              <div className="text-white text-xs md:text-sm font-medium">
                {format(current)} / {format(duration)}
              </div>
            </div>

            {/* Right: Volume and Fullscreen */}
            <div className="flex items-center gap-2 md:gap-3">
              <button aria-label="mute" onClick={(e)=>{ e.stopPropagation(); toggleMute(); showControlsTemporarily(); }} className="text-white hover:text-white/80 transition-colors">
                {muted ? <VolumeX className="w-6 h-6 md:w-7 md:h-7"/> : <Volume2 className="w-6 h-6 md:w-7 md:h-7"/>}
              </button>
              <button aria-label="fullscreen" onClick={(e)=>{ e.stopPropagation(); enterFullscreen(); }} className="text-white hover:text-white/80 transition-colors">
                <Maximize2 className="w-6 h-6 md:w-7 md:h-7"/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
