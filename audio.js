/* ═══════════════════════════════════
   TOURI — Audio Engine
   Guide audio + ambient music + ducking
═══════════════════════════════════ */

const AudioEngine = (() => {
  // Volume levels for ambient ducking
  const AMBIENT_NORMAL = 0.30;
  const AMBIENT_DUCKED = 0.08;
  const FADE_DURATION = 600; // ms

  let guideAudio = null;
  let ambientAudio = null;
  let _isPlaying = false;
  let _currentStop = null;
  let _currentLang = 'es';
  let _onEnded = null;
  let _onTimeUpdate = null;
  let _onError = null;

  /**
   * Initialize audio elements.
   */
  function init() {
    if (guideAudio) return; // Already initialized

    guideAudio = new Audio();
    guideAudio.preload = 'auto';

    ambientAudio = new Audio();
    ambientAudio.preload = 'auto';
    ambientAudio.loop = true;
    ambientAudio.volume = AMBIENT_NORMAL;

    // Guide audio events
    guideAudio.addEventListener('play', () => {
      _isPlaying = true;
      duckAmbient(true);
    });

    guideAudio.addEventListener('pause', () => {
      _isPlaying = false;
      if (guideAudio.currentTime < guideAudio.duration) {
        // Paused, not ended — keep ducked but softer
        duckAmbient(true);
      }
    });

    guideAudio.addEventListener('ended', () => {
      _isPlaying = false;
      duckAmbient(false);
      if (_onEnded) _onEnded(_currentStop);
    });

    guideAudio.addEventListener('timeupdate', () => {
      if (_onTimeUpdate) {
        _onTimeUpdate({
          currentTime: guideAudio.currentTime,
          duration: guideAudio.duration || 0,
          percent: guideAudio.duration ? (guideAudio.currentTime / guideAudio.duration) * 100 : 0,
        });
      }
    });

    guideAudio.addEventListener('error', (e) => {
      console.warn('[Audio] Guide audio error:', e);
      _isPlaying = false;
      duckAmbient(false);
      if (_onError) _onError(e);
    });
  }

  /**
   * Smoothly duck or restore ambient volume.
   */
  function duckAmbient(duck) {
    if (!ambientAudio) return;
    const target = duck ? AMBIENT_DUCKED : AMBIENT_NORMAL;
    const start = ambientAudio.volume;
    const diff = target - start;
    const steps = 20;
    const stepTime = FADE_DURATION / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      ambientAudio.volume = Math.max(0, Math.min(1,
        start + (diff * (step / steps))
      ));
      if (step >= steps) clearInterval(interval);
    }, stepTime);
  }

  /**
   * Play audio for a specific stop in a given language.
   */
  function playStop(stop, lang) {
    init();
    _currentStop = stop;
    _currentLang = lang || 'es';

    const audioSrc = stop.audio[_currentLang] || stop.audio['es'];
    if (!audioSrc) {
      console.warn('[Audio] No audio source for stop', stop.id);
      if (_onError) _onError(new Error('No audio source'));
      return;
    }

    guideAudio.src = '/' + audioSrc;
    const playPromise = guideAudio.play();

    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('[Audio] Autoplay blocked:', err);
        // Autoplay was blocked — UI needs to show play button
        if (_onError) _onError(err);
      });
    }
  }

  /**
   * Start ambient music.
   */
  function startAmbient(src) {
    init();
    if (ambientAudio.src === src && !ambientAudio.paused) return;
    ambientAudio.src = src;
    ambientAudio.volume = AMBIENT_NORMAL;
    const playPromise = ambientAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Ambient blocked — will start on next user interaction
        console.info('[Audio] Ambient autoplay blocked, will retry on interaction');
      });
    }
  }

  /**
   * Resume ambient on user interaction (for autoplay policy).
   */
  function tryResumeAmbient() {
    if (ambientAudio && ambientAudio.paused && ambientAudio.src) {
      ambientAudio.play().catch(() => {});
    }
  }

  /**
   * Stop ambient music.
   */
  function stopAmbient() {
    if (ambientAudio) {
      ambientAudio.pause();
      ambientAudio.currentTime = 0;
    }
  }

  /**
   * Play / resume guide audio.
   */
  function play() {
    init();
    if (guideAudio.src) {
      guideAudio.play().catch(() => {});
    }
  }

  /**
   * Pause guide audio.
   */
  function pause() {
    if (guideAudio) {
      guideAudio.pause();
    }
  }

  /**
   * Toggle play/pause.
   */
  function togglePlayPause() {
    if (!guideAudio) return;
    if (guideAudio.paused) {
      play();
    } else {
      pause();
    }
  }

  /**
   * Seek to a specific position (0–1 ratio).
   */
  function seekTo(ratio) {
    if (guideAudio && guideAudio.duration) {
      guideAudio.currentTime = guideAudio.duration * Math.max(0, Math.min(1, ratio));
    }
  }

  /**
   * Get current playback state.
   */
  function getPlayState() {
    if (!guideAudio) return { isPlaying: false, currentTime: 0, duration: 0 };
    return {
      isPlaying: !guideAudio.paused,
      currentTime: guideAudio.currentTime,
      duration: guideAudio.duration || 0,
    };
  }

  /**
   * Format seconds to MM:SS string.
   */
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Stop all audio and clean up.
   */
  function destroy() {
    if (guideAudio) {
      guideAudio.pause();
      guideAudio.src = '';
    }
    if (ambientAudio) {
      ambientAudio.pause();
      ambientAudio.src = '';
    }
    _isPlaying = false;
    _currentStop = null;
  }

  /* ── Event handlers ── */
  function onEnded(cb)     { _onEnded = cb; }
  function onTimeUpdate(cb){ _onTimeUpdate = cb; }
  function onError(cb)     { _onError = cb; }

  return {
    init,
    playStop,
    startAmbient,
    tryResumeAmbient,
    stopAmbient,
    play,
    pause,
    togglePlayPause,
    seekTo,
    getPlayState,
    formatTime,
    destroy,
    onEnded,
    onTimeUpdate,
    onError,
  };
})();
