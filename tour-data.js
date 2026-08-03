/* ═══════════════════════════════════
   TOURI — Tour Data Loader & State
═══════════════════════════════════ */

const TourData = (() => {
  let _tour = null;
  let _state = {
    currentStopIndex: 0,
    visitedStops: new Set(),
    startTime: null,
    isPlaying: false,
    manualMode: false,
  };

  /**
   * Load tour data from JSON file.
   */
  async function loadTour(id) {
    try {
      // Map tour ID to data file
      const fileMap = {
        'vitoria-casco-medieval': 'data/vitoria.json',
      };
      const file = fileMap[id] || `data/${id}.json`;
      const resp = await fetch(file);
      if (!resp.ok) throw new Error(`Tour not found: ${id}`);
      _tour = await resp.json();
      return _tour;
    } catch (err) {
      console.error('[TourData] Failed to load tour:', err);
      return null;
    }
  }

  /**
   * Get loaded tour.
   */
  function getTour() {
    return _tour;
  }

  /**
   * Get tour metadata in given language.
   */
  function getMeta(lang) {
    if (!_tour) return null;
    return _tour.meta[lang] || _tour.meta['es'];
  }

  /**
   * Get all stops.
   */
  function getStops() {
    return _tour?.stops || [];
  }

  /**
   * Get a specific stop by index (0-based).
   */
  function getStop(index) {
    return _tour?.stops?.[index] || null;
  }

  /**
   * Get stop by ID.
   */
  function getStopById(id) {
    return _tour?.stops?.find(s => s.id === id) || null;
  }

  /**
   * Get localized stop name.
   */
  function getStopName(stop, lang) {
    if (!stop) return '';
    return stop.name[lang] || stop.name['es'] || '';
  }

  /**
   * Get localized stop description.
   */
  function getStopDescription(stop, lang) {
    if (!stop) return '';
    return stop.description[lang] || stop.description['es'] || '';
  }

  /**
   * Get stop audio URL for given language.
   */
  function getStopAudio(stop, lang) {
    if (!stop) return null;
    return stop.audio[lang] || stop.audio['es'] || null;
  }

  /**
   * Calculate distance between two coordinates using Haversine.
   * Returns distance in meters.
   */
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate distance between two consecutive stops (in meters).
   */
  function distanceBetweenStops(stopA, stopB) {
    if (!stopA || !stopB) return 0;
    return Math.round(haversineDistance(stopA.lat, stopA.lon, stopB.lat, stopB.lon));
  }

  /**
   * Estimate walking time in minutes between two stops.
   * Assumes average walking speed of 4.5 km/h (75m/min).
   */
  function walkingTimeMinutes(stopA, stopB) {
    const dist = distanceBetweenStops(stopA, stopB);
    return Math.max(1, Math.round(dist / 75));
  }

  /* ── State Management ── */

  function getState() { return _state; }

  function setCurrentStop(index) {
    _state.currentStopIndex = index;
    saveState();
  }

  function markVisited(stopId) {
    _state.visitedStops.add(stopId);
    saveState();
  }

  function isVisited(stopId) {
    return _state.visitedStops.has(stopId);
  }

  function startTour() {
    _state.startTime = Date.now();
    _state.currentStopIndex = 0;
    _state.visitedStops = new Set();
    _state.isPlaying = true;
    saveState();
  }

  function getElapsedMinutes() {
    if (!_state.startTime) return 0;
    return Math.round((Date.now() - _state.startTime) / 60000);
  }

  function getRemainingMinutes() {
    if (!_tour) return 0;
    const elapsed = getElapsedMinutes();
    const totalEstimate = _tour.stats.duration_min;
    return Math.max(0, totalEstimate - elapsed);
  }

  function setManualMode(val) {
    _state.manualMode = val;
    saveState();
  }

  function isManualMode() {
    return _state.manualMode;
  }

  /**
   * Save state to sessionStorage for page navigation persistence.
   */
  function saveState() {
    const data = {
      currentStopIndex: _state.currentStopIndex,
      visitedStops: Array.from(_state.visitedStops),
      startTime: _state.startTime,
      isPlaying: _state.isPlaying,
      manualMode: _state.manualMode,
    };
    sessionStorage.setItem('touri_state', JSON.stringify(data));
  }

  /**
   * Restore state from sessionStorage.
   */
  function restoreState() {
    try {
      const saved = sessionStorage.getItem('touri_state');
      if (saved) {
        const data = JSON.parse(saved);
        _state.currentStopIndex = data.currentStopIndex || 0;
        _state.visitedStops = new Set(data.visitedStops || []);
        _state.startTime = data.startTime || null;
        _state.isPlaying = data.isPlaying || false;
        _state.manualMode = data.manualMode || false;
      }
    } catch (e) {
      console.warn('[TourData] Could not restore state:', e);
    }
  }

  /**
   * Clear tour state (on tour end).
   */
  function clearState() {
    _state = {
      currentStopIndex: 0,
      visitedStops: new Set(),
      startTime: null,
      isPlaying: false,
      manualMode: false,
    };
    sessionStorage.removeItem('touri_state');
  }

  /**
   * Fetch image from Wikipedia REST API based on wiki_title.
   * Returns thumbnail.source or null if failed.
   */
  async function fetchWikiImage(wikiTitle) {
    if (!wikiTitle) return null;
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data && data.originalimage && data.originalimage.source) {
        return data.originalimage.source;
      } else if (data && data.thumbnail && data.thumbnail.source) {
        return data.thumbnail.source;
      }
      return null;
    } catch (err) {
      console.warn('[TourData] Failed to fetch wiki image:', err);
      return null;
    }
  }

  // Restore on load
  restoreState();

  return {
    loadTour,
    getTour,
    getMeta,
    getStops,
    getStop,
    getStopById,
    getStopName,
    getStopDescription,
    getStopAudio,
    fetchWikiImage,
    haversineDistance,
    distanceBetweenStops,
    walkingTimeMinutes,
    getState,
    setCurrentStop,
    markVisited,
    isVisited,
    startTour,
    getElapsedMinutes,
    getRemainingMinutes,
    setManualMode,
    isManualMode,
    saveState,
    restoreState,
    clearState,
  };
})();
