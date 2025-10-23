import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';

export default function VideoPlayer({ src, poster, title='Video', showPreviewBadge=false, onReady, suppressLoadingUI=false }) {
  const ref = useRef(null);
  const containerRef = useRef(null);
  // show an immediate loading overlay when the source changes so users know
  // the video is loading and they shouldn't click expecting instant playback
  // Initialize from `src` so the overlay renders on the very first paint when
  // the component mounts with a src (avoids a render-frame delay where the
  // poster could be clickable before effects run).
  const [sourceLoading, setSourceLoading] = useState(Boolean(src));
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  // buffering: true when playback is actually stalled (not just UI progress)
  const [buffering, setBuffering] = useState(false);
  // readyState & networkState exposed for debug
  const [readyState, setReadyState] = useState(0);
  const [networkState, setNetworkState] = useState(0);
  // derived: video is considered "ready" for center play when readyState >= 3 (HAVE_FUTURE_DATA)
  const [isReady, setIsReady] = useState(false);
  const [playError, setPlayError] = useState(null);
  const hideTimer = useRef(null);
  const bufferingCheckInterval = useRef(null);
  const lastPlayProgress = useRef({ time: 0, timestamp: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  // avoid concurrent play/pause races
  const playInProgressRef = useRef(false);
  const pauseRequestedRef = useRef(false);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const onLoaded = () => {
      setDuration(v.duration || 0);
      setReadyState(v.readyState || 0);
      setNetworkState(v.networkState || 0);
      setIsReady((v.readyState || 0) >= 3);
  // loaded metadata -> we have enough info to hide the source loading UI
  setSourceLoading(false);
  try { onReady && onReady(); } catch (e) {}
      // compute initial buffered percent
      try {
        const d = v.duration || 0;
        if (d > 0 && v.buffered && v.buffered.length > 0) {
          const end = v.buffered.end(v.buffered.length - 1);
          setBufferedPercent(Math.min(100, (end / d) * 100));
        } else {
          setBufferedPercent(0);
        }
      } catch (e) {}
    };
    const onTime = () => {
      setCurrent(v.currentTime || 0);
      // record progress to help detect stuck playback
      lastPlayProgress.current = { time: v.currentTime || 0, timestamp: Date.now() };
      // update buffered percent as time moves (in case progress events are sparse)
      try {
        const d = v.duration || 0;
        if (d > 0 && v.buffered && v.buffered.length > 0) {
          // find the buffered range that contains or is after current time
          let end = 0;
          for (let i = 0; i < v.buffered.length; i++) {
            end = Math.max(end, v.buffered.end(i));
          }
          setBufferedPercent(Math.min(100, (end / d) * 100));
        }
      } catch (e) {}
    };
    const onEnd = () => setPlaying(false);
    const onWaiting = () => {
      // native waiting usually indicates buffering
        // native waiting often fires for very short stalls; debounce to avoid
        // showing the spinner for brief network hiccups. We'll set a short
        // timeout and only mark buffering if the waiting state persists.
        if (bufferingCheckInterval.current) { /* reuse */ }
        // schedule a gentle check after a short delay
        const waitId = setTimeout(() => {
          // if the player still reports readyState < 3 and hasn't progressed,
          // treat as buffering
          try {
            if (ref.current && (ref.current.readyState || 0) < 3) {
              // only mark buffering if no recent progress
              const last = lastPlayProgress.current || { time: 0, timestamp: 0 };
              if (Date.now() - (last.timestamp || 0) > 700) {
                setBuffering(true);
              }
            }
          } catch (e) {}
        }, 350);
        // attach to ref so we can clear if canplay/playing fires
        try { ref.current._waitingDebounce = waitId; } catch (e) {}
    };
    const onCanPlay = () => {
      setBuffering(false);
      setIsReady(true);
      setSourceLoading(false);
      try { onReady && onReady(); } catch (e) {}
    // clear any waiting debounce timers
    try { if (ref.current && ref.current._waitingDebounce) { clearTimeout(ref.current._waitingDebounce); ref.current._waitingDebounce = null; } } catch (e) {}
    };
    const onCanPlayThrough = () => {
      setBuffering(false);
      setIsReady(true);
      setSourceLoading(false);
      try { onReady && onReady(); } catch (e) {}
    try { if (ref.current && ref.current._waitingDebounce) { clearTimeout(ref.current._waitingDebounce); ref.current._waitingDebounce = null; } } catch (e) {}
    };
    const onStalled = () => {
      // browser couldn't fetch data
        // browser couldn't fetch data — treat similarly to waiting but keep it
        // debounced to avoid false positives for short stalls.
        setTimeout(() => {
          try {
            if (ref.current && (ref.current.readyState || 0) < 3) {
              setBuffering(true);
            }
          } catch (e) {}
        }, 500);
    };
    // helper: compute adaptive thresholds based on duration
    function getAdaptiveThresholds(duration) {
      // duration in seconds. For very short clips, we use smaller headroom and
      // shorter detection windows. For longer clips we remain conservative.
      if (!isFinite(duration) || duration <= 0) {
        return { bufferedHeadroom: 0.8, stalledWindowMs: 3000, progressTolerance: 0.12 };
      }
      if (duration <= 8) {
        // tiny clips: be very forgiving
        return { bufferedHeadroom: 0.12, stalledWindowMs: 900, progressTolerance: 0.05 };
      } else if (duration <= 30) {
        // short clips: small headroom, faster detection
        return { bufferedHeadroom: 0.25, stalledWindowMs: 1500, progressTolerance: 0.08 };
      } else if (duration <= 90) {
        // medium clips
        return { bufferedHeadroom: 0.6, stalledWindowMs: 2500, progressTolerance: 0.1 };
      }
      // long clips
      return { bufferedHeadroom: 0.8, stalledWindowMs: 3000, progressTolerance: 0.12 };
    }

    const onProgress = () => {
      try {
        setReadyState(v.readyState || 0);
        setNetworkState(v.networkState || 0);
      } catch (e) {}

      try {
        const buffered = v.buffered;
        const t = v.currentTime || 0;
        let bufferedAhead = 0;
        for (let i = 0; i < (buffered?.length || 0); i++) {
          if (t >= buffered.start(i) && t <= buffered.end(i)) {
            bufferedAhead = buffered.end(i) - t;
            break;
          }
        }

        // update buffered percent (existing behavior)
        try {
          const d = v.duration || 0;
          if (d > 0) {
            const bufferedEnd = buffered.end(buffered.length - 1);
            setBufferedPercent(Math.min(100, (bufferedEnd / d) * 100));
          }
        } catch (e) {}

        // adaptive thresholds
        const d = v.duration || 0;
        const { bufferedHeadroom, stalledWindowMs, progressTolerance } = getAdaptiveThresholds(d);
        const last = lastPlayProgress.current || { time: 0, timestamp: 0 };
        const since = Date.now() - (last.timestamp || 0);
        const timeAdvanced = (v.currentTime || 0) - (last.time || 0);

        // If we have enough buffered ahead for this clip and playback has made progress,
        // clear buffering. Using adaptive headroom prevents false positives on short clips.
        if (bufferedAhead > bufferedHeadroom && (timeAdvanced > progressTolerance || since < stalledWindowMs)) {
          setBuffering(false);
        }
      } catch (e) {}
    };

    const onPlay = () => {
      setPlaying(true);
      // playback started -> hide source-loading overlay if still visible
      setSourceLoading(false);
      try { onReady && onReady(); } catch (e) {}
      // start periodic check to detect stalled playback even if no waiting fired
      // Be tolerant: prefer the browser readyState when available and use a
      // slightly larger observation window to avoid flapping on transient stalls.
      if (bufferingCheckInterval.current) clearInterval(bufferingCheckInterval.current);
      bufferingCheckInterval.current = setInterval(() => {
        if (!v) return;
        const now = Date.now();
        const last = lastPlayProgress.current || { time: 0, timestamp: 0 };

        // If browser reports a healthy readyState, treat as not buffering
        if ((v.readyState || 0) >= 3) { setBuffering(false); return; }

        // tolerance adapts to duration
        const d = v.duration || 0;
        const { bufferedHeadroom, stalledWindowMs, progressTolerance } = getAdaptiveThresholds(d);

        // if not paused, check if time made progress recently
        if (!v.paused) {
          const timeAdvanced = (v.currentTime || 0) - (last.time || 0);
          const since = now - (last.timestamp || 0);

          // only mark buffering when there's been little progress for a longer than allowed window
          if (since > stalledWindowMs && timeAdvanced < progressTolerance) {
            // double-check buffered ranges: only mark buffering if bufferedAhead is tiny
            let bufferedAhead = 0;
            try {
              const t = v.currentTime || 0;
              for (let i = 0; i < (v.buffered?.length || 0); i++) {
                if (t >= v.buffered.start(i) && t <= v.buffered.end(i)) {
                  bufferedAhead = v.buffered.end(i) - t;
                  break;
                }
              }
            } catch (e) { bufferedAhead = 0; }

            if (bufferedAhead < Math.min(0.2, bufferedHeadroom)) setBuffering(true);
            else setBuffering(false);
          } else {
            setBuffering(false);
          }
        }
      }, 700);
    };
    const onPause = () => {
      setPlaying(false);
      // paused -> not buffering
      setBuffering(false);
      if (bufferingCheckInterval.current) { clearInterval(bufferingCheckInterval.current); bufferingCheckInterval.current = null; }
    };
    const onPlaying = () => {
      setBuffering(false);
      setPlaying(true);
    };
  // removed PiP handlers
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('canplaythrough', onCanPlayThrough);
    v.addEventListener('stalled', onStalled);
    v.addEventListener('progress', onProgress);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('playing', onPlaying);
  // (PiP removed)
  document.addEventListener('fullscreenchange', onFullscreenChange);
    
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('canplaythrough', onCanPlayThrough);
      v.removeEventListener('stalled', onStalled);
      v.removeEventListener('progress', onProgress);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('playing', onPlaying);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (bufferingCheckInterval.current) { clearInterval(bufferingCheckInterval.current); bufferingCheckInterval.current = null; }
    };
  }, []);

  // toggle a class on container when entering/exiting fullscreen to help with layout
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    if (isFullscreen) {
      el.classList.add('is-fullscreen');
    } else {
      el.classList.remove('is-fullscreen');
    }
  }, [isFullscreen]);

  // PiP/speed menu removed

  useEffect(() => {
    const v = ref.current; if (!v) return;
    // When source changes, prefer seeking to 0 if the browser already has
    // the same resolved source to avoid forcing a full reload which causes
    // re-buffering. Only call load() when the effective source actually
    // changes.
    setPlaying(false);
    setCurrent(0);
    const resolveSame = (el, newSrc) => {
      try {
        if (!newSrc) return false;
        // el.currentSrc may be absolute; compare resolved hrefs when possible
        const a = el.currentSrc || el.src || '';
        // try URL resolution fallback
        try {
          const left = new URL(a, window.location.href).href;
          const right = new URL(newSrc, window.location.href).href;
          return left === right;
        } catch (e) {
          return String(a) === String(newSrc);
        }
      } catch (e) { return false; }
    };

    if (src) setSourceLoading(true);

    const isSame = resolveSame(v, src);
    if (isSame) {
      // Avoid reinitializing the element — seek to start so buffered data can be reused
      try { if (typeof v.currentTime !== 'undefined') v.currentTime = 0; } catch (e) {}
      // clear any existing buffering interval when source changes
      if (bufferingCheckInterval.current) { clearInterval(bufferingCheckInterval.current); bufferingCheckInterval.current = null; }
      setIsFullscreen(!!document.fullscreenElement);
      return;
    }

    // Different source: allow the browser to load the new resource. Calling
    // load() is fine here because the src actually changed.
    try { v.load && v.load(); } catch (e) {}
    if (bufferingCheckInterval.current) { clearInterval(bufferingCheckInterval.current); bufferingCheckInterval.current = null; }
    setIsFullscreen(!!document.fullscreenElement);
  }, [src]);

  // Ensure the loading overlay is shown as soon as `src` changes even if the
  // video element ref isn't mounted yet. The other effect that calls
  // ref.current may return early if the ref isn't ready, so this guarantees
  // immediate feedback to the user.
  useEffect(() => {
    if (src) {
      setSourceLoading(true);
    } else {
      setSourceLoading(false);
    }
    // no cleanup required
  }, [src]);

  // On mount, immediately show the loading overlay (so users don't see a
  // clickable poster while the signed URL / src is being fetched). If the
  // video element is already ready, clear the overlay immediately to avoid
  // flicker.
  useEffect(() => {
    setSourceLoading(true);
    const v = ref.current;
    if (v && (v.readyState >= 3 || v.readyState > 0)) {
      // already have metadata/ready data, hide overlay
      setSourceLoading(false);
    }
    // no cleanup
  }, []);

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
  // debug logs removed to reduce console noise in production

    // If currently playing, request a pause. If a play is in progress, mark pauseRequested and return —
    // we'll pause once the in-flight play resolves to avoid aborting the play promise.
    if (playing) {
      if (playInProgressRef.current) {
  pauseRequestedRef.current = true;
        return;
      }
      try { v.pause(); setPlaying(false); } catch (e) { console.warn('[VideoPlayer] pause failed', e); }
      return;
    }

    // If a play is already in progress, ignore subsequent play requests
  if (playInProgressRef.current) { return; }

    playInProgressRef.current = true;
    pauseRequestedRef.current = false;
    try {
      await v.play();
      // If user asked to pause while play was pending, honor it now
      if (pauseRequestedRef.current) {
        try { v.pause(); setPlaying(false); } catch (e) { /* keep minimal logging */ }
      } else {
        setPlaying(true);
        setPlayError(null);
      }
    } catch (err) {
      // play() failed (e.g., user gesture required) - surface to UI but avoid noisy console logs
      try { setPlayError(err?.message || String(err)); } catch (e) {}
      // Retry muted (user clicked) — some browsers allow a user gesture to play if muted
      try {
        // If a pause was requested while we were attempting to play, don't attempt a muted retry
        if (pauseRequestedRef.current) {
          // skip muted retry if a pause was requested
        } else {
          v.muted = true;
          await v.play();
          if (pauseRequestedRef.current) {
            try { v.pause(); setPlaying(false); } catch (e) { /* silent */ }
          } else {
            setPlaying(true);
            setPlayError('Playback started muted (muted retry)');
            setMuted(true);
          }
        }
      } catch (err2) {
        /* muted retry failed - handled via UI state (playError) */
      }
    } finally {
      playInProgressRef.current = false;
      pauseRequestedRef.current = false;
    }
  };
  const format = (t) => { if (!isFinite(t)) return '0:00'; const m = Math.floor(t/60); const s = Math.floor(t%60).toString().padStart(2,'0'); return `${m}:${s}`; };
  const onSeek = (e) => { const v = ref.current; if (!v) return; v.currentTime = Number(e.target.value); setCurrent(Number(e.target.value)); };
  const toggleMute = () => {
    const v = ref.current; if (!v) return;
    // toggling mute shouldn't interrupt playback attempts. Just update muted state.
    const newMuted = !v.muted;
    try { v.muted = newMuted; } catch (e) { console.warn('[VideoPlayer] toggleMute failed', e); }
    setMuted(newMuted);
  };
  const enterFullscreen = () => { const el = containerRef.current; if (!el) return; if (el.requestFullscreen) el.requestFullscreen(); };
  // skip buttons removed to increase seek bar space on mobile
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const el = containerRef.current; if (!el) return; await el.requestFullscreen();
      }
    } catch (e) { console.warn('fullscreen toggle failed', e); }
  };
  // PiP and speed controls removed

  const onContainerTap = (ev) => {
    const target = ev.target;
    // Don't toggle if clicking on controls
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
      showControlsTemporarily();
      return;
    }
    // single tap: if controls hidden -> show them, otherwise toggle play
    if (!controlsVisible) {
      showControlsTemporarily();
      return;
    }
    // controls visible -> toggle playback
    togglePlay();
  };

  const progressPercent = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-xl overflow-hidden select-none group"
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
      onClick={onContainerTap}
      style={!isFullscreen ? { aspectRatio: '16/9', maxWidth: '100%' } : undefined}
    >
      <video
        ref={ref}
        src={src || undefined}
        poster={poster}
        className={isFullscreen ? "w-full h-full object-contain cedi-video" : "w-full h-full object-cover cedi-video"}
        preload="auto"
        playsInline
        // removed native controls to avoid browser center-play overlay
        crossOrigin="anonymous"
        controlsList="nodownload"
      />

      {/* Immediate blocking loading overlay shown when sourceLoading is true.
          It's modern (semi-transparent backdrop + spinner + subtle text) and
          prevents clicks while the video is fetching initial data. */}
      {sourceLoading && !suppressLoadingUI && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-t-transparent border-white/90 rounded-full animate-spin" />
            <div className="text-sm text-white/90">Loading video…</div>
          </div>
        </div>
      )}

      {/* hide native center play overlays where possible (vendor prefixed selectors) */}
      <style>{`
        .cedi-video::-webkit-media-controls-overlay-play-button { display: none !important; }
        .cedi-video::-webkit-media-controls-start-playback-button { display: none !important; }
        /* Firefox uses different controls; attempt to hide large play button */
        .cedi-video::-moz-loading { display: none !important; }
        /* fullscreen container/video fixes */
        .is-fullscreen { width: 100% !important; height: 100% !important; }
        .is-fullscreen .cedi-video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
      `}</style>

      {/* custom center play overlay: only show when video is ready and not buffering */}
      {controlsVisible && (!playing) && isReady && !buffering && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto px-4">
          <button
            aria-label="Play"
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/60 flex items-center justify-center shadow-lg"
          >
            <Play className="w-6 h-6 md:w-8 md:h-8 text-white" />
          </button>
        </div>
      )}

      {/* small buffering spinner (only when actually buffering) */}
      {buffering && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-t-transparent border-white/80 rounded-full animate-spin" />
        </div>
      )}

      {/* Responsive modern control bar (mobile-friendly) */}
      {controlsVisible && (
        <div className="absolute left-0 right-0 bottom-0 z-40 bg-gradient-to-t from-black/80 to-transparent p-1 md:p-3 flex items-center md:gap-3 gap-1">
          <div className="flex items-center gap-1 md:gap-3 flex-none">
            <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} className="p-1 md:p-2 touch-manipulation">
              {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-1 mx-1">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/90 w-20 md:w-24">{format(current)} / {format(duration)}</div>
            </div>
            <div className="relative w-full h-1 md:h-1.5 rounded overflow-visible bg-white/10">
              {/* buffered bar (light) */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full rounded bg-white/30 overflow-hidden">
                <div className="h-full bg-white/30" style={{ width: `${bufferedPercent}%` }} />
              </div>
              {/* played bar (accent) */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded bg-purple-500" style={{ width: `${progressPercent}%` }} />

              {/* visible thumb indicator (matches played progress). pointer-events none so the underlying range handles input */}
              <div
                aria-hidden
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              >
                <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-white border-2 border-purple-600 shadow-lg" />
              </div>

              {/* transparent range input for interaction; keep it full-height to have a good touch target */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                step="0.01"
                value={current}
                onChange={onSeek}
                className="absolute left-0 top-0 w-full h-6 md:h-8 opacity-0 cursor-pointer"
                aria-label="Seek"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-3 flex-none">
            <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="p-1 md:p-2">
              {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
            <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'} className="p-1 md:p-2">{isFullscreen ? <Minimize2 className="w-5 h-5 text-white" /> : <Maximize2 className="w-5 h-5 text-white" />}</button>
          </div>
        </div>
      )}

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
