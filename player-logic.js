// ═══════════════════════════════════
// TOURI — Player Logic (Rediseño)
// ═══════════════════════════════════

let tourId = new URLSearchParams(window.location.search).get('id') || 'vitoria-casco-medieval';
let stops = [];
let currentStopIndex = 0;
let compassHeading = 0;
let userLat = null;
let userLng = null;
let isPlayingAudio = false;
let map = null;
let mapMarkers = [];

// ─── INIT ───
async function init() {
  const tour = await TourData.loadTour(tourId);
  if (!tour) {
    showToast('Error cargando el tour');
    return;
  }
  stops = TourData.getStops();
  currentStopIndex = TourData.getState().currentStopIndex || 0;
  
  applyTranslations();
  setupAudio();
  initMap();

  // Compass orientation
  window.addEventListener('deviceorientationabsolute', handleOrientation, true);
  window.addEventListener('deviceorientation', handleOrientation, true);
  
  // GPS Listeners
  document.addEventListener('gpsPosition', (e) => {
    userLat = e.detail.lat;
    userLng = e.detail.lon;
    
    const stop = stops[currentStopIndex];
    if (stop) {
      const dist = GPS.haversineDistance(userLat, userLng, stop.lat, stop.lon);
      const walkDistEl = document.getElementById('walkDist');
      if(walkDistEl) walkDistEl.textContent = Math.round(dist);
    }
  });
  
  document.addEventListener('gpsError', (e) => {
    console.warn('GPS Error', e.detail);
  });
  
  startTour();
}

function handleOrientation(e) {
  if (e.alpha !== null) {
    compassHeading = e.webkitCompassHeading || (360 - e.alpha);
  }
}

// ─── SCREENS ───
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const activeScreen = document.getElementById(id);
  if (activeScreen) activeScreen.classList.add('active');
  
  if (id === 'screen-route' && map) {
    setTimeout(() => { map.invalidateSize(); }, 300);
  }
}
window.showScreen = showScreen;

// ─── TOUR LOGIC ───
function startTour() {
  if (!TourData.getState().isPlaying) {
    TourData.startTour();
  }
  GPS.startTracking(stops, (stop, index, distance) => {
    if (!TourData.isVisited(stop.id)) {
      TourData.markVisited(stop.id);
      currentStopIndex = index;
      TourData.setCurrentStop(index);
      onArrival();
    }
  });
  AudioEngine.startAmbient('ambientetren.mp3');
  
  if (TourData.isVisited(stops[currentStopIndex].id)) {
    updateArrivedScreen();
  } else {
    updateWalkingScreen();
  }
}

// ─── WALKING SCREEN ───
function updateWalkingScreen() {
  const stop = stops[currentStopIndex];
  if (!stop) return;
  const lang = getLang();
  
  const nameEl = document.getElementById('walkStopName');
  if(nameEl) nameEl.innerHTML = `Buscando<br/>Ubicación...`; 
  
  const numEl = document.getElementById('walkStopNum');
  if(numEl) numEl.textContent = `PARADA ${currentStopIndex + 1} DE ${stops.length}`;
  
  const nextNameEl = document.getElementById('nextStopName');
  if(nextNameEl) nextNameEl.textContent = `Próxima: ${TourData.getStopName(stop, lang)}`;
  
  const pillEl = document.getElementById('walkProgressPill');
  if(pillEl) pillEl.textContent = `${currentStopIndex + 1}/${stops.length}`;
  
  const remainEl = document.getElementById('tourRemain');
  if(remainEl) remainEl.textContent = TourData.getRemainingMinutes();
  
  updateMapMarkers();
}

// ─── ARRIVAL SCREEN ───
function onArrival() {
  if ('vibrate' in navigator) navigator.vibrate([100,50,200]);
  updateArrivedScreen();
  const stop = stops[currentStopIndex];
  AudioEngine.playStop(stop, getLang());
  updatePlayUI(true);
}

async function updateArrivedScreen() {
  const stop = stops[currentStopIndex];
  const lang = getLang();
  
  const nameEl = document.getElementById('walkStopName');
  if(nameEl) nameEl.innerHTML = TourData.getStopName(stop, lang);
  
  const numEl = document.getElementById('walkStopNum');
  if(numEl) numEl.textContent = `PARADA ${currentStopIndex + 1} DE ${stops.length}`;

  const arrivedNameEl = document.getElementById('arrivedName');
  if(arrivedNameEl) arrivedNameEl.textContent = TourData.getStopName(stop, lang);
  
  const arrivedNumEl = document.getElementById('arrivedStopNum');
  if(arrivedNumEl) arrivedNumEl.textContent = `CAPÍTULO ${(currentStopIndex + 1).toString().padStart(2, '0')} · AHORA`;

  const photoEl = document.getElementById('arrivedPhoto');
  const playerBg = document.getElementById('player-bg');
  if (stop.wiki_title) {
    const imgUrl = await TourData.fetchWikiImage(stop.wiki_title);
    if (imgUrl) {
      if(photoEl) photoEl.style.backgroundImage = `url(${imgUrl})`;
      if(playerBg) playerBg.src = imgUrl;
    }
  }

  const nextNameEl = document.getElementById('nextStopName');
  if (currentStopIndex < stops.length - 1) {
    const nextStop = stops[currentStopIndex + 1];
    if(nextNameEl) nextNameEl.textContent = `Próxima: ${TourData.getStopName(nextStop, lang)}`;
  } else {
    if(nextNameEl) nextNameEl.textContent = `Última parada del recorrido`;
  }
  
  const pillEl = document.getElementById('walkProgressPill');
  if(pillEl) pillEl.textContent = `${currentStopIndex + 1}/${stops.length}`;
  
  const remainEl = document.getElementById('tourRemain');
  if(remainEl) remainEl.textContent = TourData.getRemainingMinutes();

  updateMapMarkers();
}

window.goToNext = function() {
  AudioEngine.pause();
  updatePlayUI(false);
  if (currentStopIndex < stops.length - 1) {
    currentStopIndex++;
    TourData.setCurrentStop(currentStopIndex);
    updateWalkingScreen();
  } else {
    showToast('Tour completado');
    window.location.href = 'tour-end.html?id=' + tourId;
  }
};

// ─── AUDIO ENGINE ───
function setupAudio() {
  AudioEngine.onTimeUpdate((info) => {});
  AudioEngine.onEnded(() => {
    updatePlayUI(false);
  });
}

window.togglePlay = function() {
  AudioEngine.togglePlayPause();
  const state = AudioEngine.getPlayState();
  updatePlayUI(state.isPlaying);
};

window.skipBack = function() {
  const state = AudioEngine.getPlayState();
  AudioEngine.seekTo((state.currentTime - 15) / state.duration);
};

window.skipForward = function() {
  const state = AudioEngine.getPlayState();
  AudioEngine.seekTo((state.currentTime + 15) / state.duration);
};

function updatePlayUI(isPlaying) {
  isPlayingAudio = isPlaying;
  const icon = document.getElementById('play-icon');
  if (isPlaying) {
    if(icon) icon.innerHTML = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
  } else {
    if(icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  }
}

// ─── MAP ───
function initMap() {
  map = L.map('map', { zoomControl: false }).setView([42.846718, -2.671635], 16);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO'
  }).addTo(map);
  window.map = map;
  
  const latlngs = [];
  stops.forEach((stop, i) => {
    latlngs.push([stop.lat, stop.lon]);
    const marker = L.marker([stop.lat, stop.lon]).addTo(map).on('click', () => {
      jumpToStop(i);
    });
    mapMarkers.push(marker);
  });
  
  L.polyline(latlngs, { color: '#94A35D', weight: 2.5, dashArray: '1 7', opacity: 0.7, lineCap: 'round' }).addTo(map);
  
  updateMapMarkers();
}

function updateMapMarkers() {
  stops.forEach((stop, i) => {
    const isCurrent = i === currentStopIndex;
    
    let html = '';
    if (isCurrent) {
      html = `<div style="width:20px; height:20px; border-radius:50%; background:#F4EF9F; border:3px solid #232321; box-shadow:0 0 0 1.5px #F4EF9F; animation: pulse-marker 2s infinite;"></div>
              <style>
                @keyframes pulse-marker {
                  0%, 100% { box-shadow: 0 0 0 2px rgba(244,239,159,.35); }
                  50%      { box-shadow: 0 0 0 10px rgba(244,239,159,.2); }
                }
              </style>`;
    } else {
      html = `<div style="width:12px; height:12px; border-radius:50%; background:#5a6b45;"></div>`;
    }
    
    mapMarkers[i].setIcon(L.divIcon({ html, className: '' }));
  });
}

function jumpToStop(i) {
  AudioEngine.pause();
  updatePlayUI(false);
  currentStopIndex = i;
  TourData.setCurrentStop(i);
  if (TourData.isVisited(stops[i].id)) {
    updateArrivedScreen();
  } else {
    updateWalkingScreen();
  }
}

// ─── UTILS ───
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toastText').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

document.addEventListener('DOMContentLoaded', init);
