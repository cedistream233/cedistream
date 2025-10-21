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
  const [readyState, setReadyState] = useState(0);
  const [networkState, setNetworkState] = useState(0);
  const [playError, setPlayError] = useState(null);
  const hideTimer = useRef(null);

  useEffect(() => {
    const v = ref.current; if (!v) return;
  const onLoaded = () => { setDuration(v.duration || 0); setReadyState(v.readyState || 0); setNetworkState(v.networkState || 0); };
    const onTime = () => setCurrent(v.currentTime || 0);
    const onEnd = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
  const onProgress = () => { try { setReadyState(v.readyState || 0); setNetworkState(v.networkState || 0); } catch(e){} };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onPlaying = () => setBuffering(false);
    
    v.addEventListener('loadedmetadata', onLoaded);
  v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('canplay', onCanPlay);
  v.addEventListener('progress', onProgress);
  v.addEventListener('play', onPlay);
  v.addEventListener('pause', onPause);
    v.addEventListener('playing', onPlaying);
    
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
        v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('canplay', onCanPlay);
        v.removeEventListener('progress', onProgress);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
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

  const togglePlay = async () => {
    const v = ref.current; if (!v) { console.debug('[VideoPlayer] no video element'); return; }
    console.debug('[VideoPlayer] togglePlay', { playing, src: v.currentSrc || src, paused: v.paused, readyState: v.readyState, currentTime: v.currentTime });
    if (playing) { try { v.pause(); setPlaying(false); } catch (e) { console.warn('[VideoPlayer] pause failed', e); } return; }
    try {
      await v.play();
      setPlaying(true);
      setPlayError(null);
      console.debug('[VideoPlayer] play succeeded');
    } catch (err) {
      console.warn('[VideoPlayer] play() failed', err);
      try { setPlayError(err?.message || String(err)); } catch(e){}
      // Retry muted (user clicked) — some browsers allow a user gesture to play if muted
      try {
        v.muted = true;
        await v.play();
        setPlaying(true);
        setPlayError('Playback started muted (muted retry)');
        setMuted(true);
        console.debug('[VideoPlayer] play succeeded after muted retry');
        return;
      } catch (err2) {
        console.warn('[VideoPlayer] muted retry failed', err2);
      }
    }
  };
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
    <div ref={containerRef} className="relative bg-black rounded-xl overflow-hidden select-none group">
      <video
        ref={ref}
        src={src || undefined}
        poster={poster}
        className="w-full h-auto block"
        preload="auto"
        playsInline
        controls
        crossOrigin="anonymous"
        controlsList="nodownload"
      />

      {/* Debug panel (enable via URL ?debugVideo=1) */}
      {typeof window !== 'undefined' && window.location.search.includes('debugVideo=1') && (
        <div className="absolute top-2 left-2 z-30 bg-black/70 text-white text-xs p-2 rounded">
          <div>readyState: {readyState}</div>
          <div>networkState: {networkState}</div>
          <div>paused: {String(ref.current?.paused ?? true)}</div>
          <div>currentTime: {Number(ref.current?.currentTime ?? 0).toFixed(2)}</div>
          <div style={{maxWidth:300,wordBreak:'break-all'}}>src: {ref.current?.currentSrc || src}</div>
          <div>buffered: {Array.from({length: ref.current?.buffered?.length || 0}).map((_,i)=>`${ref.current.buffered.start(i).toFixed(1)}-${ref.current.buffered.end(i).toFixed(1)}`).join(', ')}</div>
          <div style={{color: playError ? 'salmon' : 'inherit'}}>playError: {playError || 'none'}</div>
        </div>
      )}

      {showPreviewBadge && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded z-20">Preview</div>
      )}

      {/* Buffering handled by native player; custom overlay removed to avoid duplicate spinner */}

      {/* Play error banner */}
      {playError && (
        <div className="absolute bottom-16 left-4 right-4 z-40 bg-red-600 text-white text-sm p-2 rounded text-center">
          Playback failed: {playError}
        </div>
      )}

      {/* removed center overlay to rely on native controls for reliable user gesture playback */}

      {/* Using native browser controls (custom controls removed to avoid duplicate UI) */}
    </div>
  );
}
