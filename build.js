const fs = require('fs');
const ui = fs.readFileSync('temp_ui.html', 'utf8');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#4A7C59">
  <title>Touri — En Ruta</title>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="player-nav.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
  <style>
    /* Leaflet overrides */
    .leaflet-container { background: #1A1A28 !important; }
    .map-container { position: relative; width: 100%; height: 100%; border-radius: 16px; overflow: hidden; }
    #map { position: absolute; inset: 0; width: 100%; height: 100%; }
    .fallback-img { background: #3D3B33; display: flex; align-items: center; justify-content: center; }
    .fallback-num { font-family: 'Outfit', sans-serif; font-size: 120px; font-weight: 800; color: rgba(240, 237, 228, 0.2); }
  </style>
</head>
<body>
${ui}

  <!-- Scripts -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script src="i18n.js"></script>
  <script src="tour-data.js"></script>
  <script src="audio.js"></script>
  <script src="gps.js"></script>
  <script src="player-logic.js"></script>
</body>
</html>`;

fs.writeFileSync('tour-player.html', html);
console.log('tour-player.html overwritten');
