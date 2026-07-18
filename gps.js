/* ═══════════════════════════════════
   TOURI — GPS Engine
   Based on Geolocation API watchPosition
═══════════════════════════════════ */

const GPS = (() => {
  let _watchId = null;
  let _stops = [];
  let _onEnterStop = null;
  let _triggeredStops = new Set();
  let _lastPosition = null;
  let _isTracking = false;

  /**
   * Request geolocation permission.
   * Returns: 'granted' | 'denied' | 'prompt' | 'error'
   */
  async function requestPermission() {
    if (!navigator.geolocation) {
      return 'error';
    }

    // Try the Permissions API first (not all browsers support it for geolocation)
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'granted' || perm.state === 'prompt') {
        return perm.state;
      }
      return 'denied';
    } catch (e) {
      // Permissions API not supported — try direct request
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (err) => {
            if (err.code === err.PERMISSION_DENIED) resolve('denied');
            else resolve('error');
          },
          { timeout: 10000 }
        );
      });
    }
  }

  /**
   * Start GPS tracking.
   * @param {Array} stops - Array of stop objects with lat, lon, radius
   * @param {Function} onEnterStop - Callback when user enters a stop's radius
   */
  function startTracking(stops, onEnterStop) {
    if (!navigator.geolocation) {
      console.error('[GPS] Geolocation not supported');
      return false;
    }

    _stops = stops;
    _onEnterStop = onEnterStop;
    _isTracking = true;

    const pollGPS = () => {
      if (!_isTracking) return;
      navigator.geolocation.getCurrentPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 4500,
        }
      );
    };

    pollGPS();
    _watchId = setInterval(pollGPS, 5000);

    console.log('[GPS] Tracking started (polling every 5s), intervalId:', _watchId);
    return true;
  }

  /**
   * Stop GPS tracking.
   */
  function stopTracking() {
    if (_watchId !== null) {
      clearInterval(_watchId);
      _watchId = null;
    }
    _isTracking = false;
    console.log('[GPS] Tracking stopped');
  }

  /**
   * Handle incoming position.
   */
  function handlePosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    _lastPosition = { lat: latitude, lon: longitude, accuracy };

    // Dispatch position update event
    document.dispatchEvent(new CustomEvent('gpsPosition', {
      detail: _lastPosition
    }));

    // Check proximity to each untriggered stop
    _stops.forEach((stop, index) => {
      if (_triggeredStops.has(stop.id)) return;

      const distance = haversineDistance(latitude, longitude, stop.lat, stop.lon);
      const radius = stop.radius || 10;

      if (distance <= radius) {
        _triggeredStops.add(stop.id);
        console.log(`[GPS] Entered stop ${stop.id} at ${distance.toFixed(1)}m (radius: ${radius}m)`);
        if (_onEnterStop) {
          _onEnterStop(stop, index, distance);
        }
      }
    });
  }

  /**
   * Handle GPS error.
   */
  function handleError(error) {
    console.warn('[GPS] Error:', error.message);
    document.dispatchEvent(new CustomEvent('gpsError', {
      detail: { code: error.code, message: error.message }
    }));
  }

  /**
   * Haversine distance in meters.
   */
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Get distance from current position to a stop.
   * Returns distance in meters or null if no position.
   */
  function getDistanceToStop(stop) {
    if (!_lastPosition) return null;
    return Math.round(
      haversineDistance(_lastPosition.lat, _lastPosition.lon, stop.lat, stop.lon)
    );
  }

  /**
   * Get distance between two stops in meters.
   */
  function getDistanceBetweenStops(stopA, stopB) {
    return Math.round(
      haversineDistance(stopA.lat, stopA.lon, stopB.lat, stopB.lon)
    );
  }

  /**
   * Mark a stop as already triggered (e.g., play_on_start).
   */
  function markTriggered(stopId) {
    _triggeredStops.add(stopId);
  }

  /**
   * Reset triggered stops (for tour restart).
   */
  function resetTriggered() {
    _triggeredStops.clear();
  }

  /**
   * Get last known position.
   */
  function getLastPosition() {
    return _lastPosition;
  }

  /**
   * Is GPS currently tracking?
   */
  function isTracking() {
    return _isTracking;
  }

  return {
    requestPermission,
    startTracking,
    stopTracking,
    getDistanceToStop,
    getDistanceBetweenStops,
    markTriggered,
    resetTriggered,
    getLastPosition,
    isTracking,
    haversineDistance,
  };
})();
