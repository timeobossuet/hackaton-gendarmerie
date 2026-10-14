// initialiser la carte centrée sur Toulouse
const map = L.map("map").setView([43.6045, 1.444], 13);

// 2. Ajouter le fond de carte OpenStreetMap
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// 3. Variables globales pour stocker nos couches et données
let routesLayer, polygonsLayer;
const zonesLayer = new L.FeatureGroup();
map.addLayer(zonesLayer);
// Variables pour la zone de sécurité autour du GPX
let bufferLayer = new L.FeatureGroup();
map.addLayer(bufferLayer);
let currentGpxGeoJson = null;
let currentRadius = 200; // Rayon par défaut en mètres

// 4. Charger en parallèle les deux fichiers GeoJSON (Lignes et Polygones)
Promise.all([
  fetch("cartes/toulouse_lines.geojson").then(res => res.json()),
  fetch("cartes/toulouse_polygons.geojson").then(res => res.json())
])
.then(([linesData, polygonsData]) => {

  // A. Traitement de la couche des polygones (bâtiments / zones)
  polygonsLayer = L.geoJSON(polygonsData, {
    style: {
      color: "#2e7d32",      // Vert pour les polygones/bâtiments
      weight: 1,
      fillColor: "#4caf50",
      fillOpacity: 0.3
    },
    onEachFeature: (feature, layer) => {
      if (feature.properties && feature.properties.name) {
        layer.bindPopup(`<strong>Zone/Bâtiment :</strong> ${feature.properties.name}`);
      }
    }
  }).addTo(map);

  // B. Traitement de la couche des lignes (routes)
  routesLayer = L.geoJSON(linesData, {
    style: {
      color: "#3388ff",      // Bleu pour les routes
      weight: 2,
      opacity: 0.8
    },
    onEachFeature: (feature, layer) => {
      if (feature.properties && feature.properties.name) {
        layer.bindPopup(`<strong>Route :</strong> ${feature.properties.name}`);
      }
    }
  }).addTo(map);

  // Cadrer la carte sur l'ensemble des routes chargées
  if (routesLayer.getBounds().isValid()) {
    map.fitBounds(routesLayer.getBounds());
  }

  // Activer les outils de dessin une fois les données prêtes
  activerSelection();
})
.catch(error => {
  console.error("Erreur lors du chargement des fichiers GeoJSON :", error);
});


// 5. Gestion des outils de dessin (Leaflet.Draw)
function activerSelection() {
  const drawControl = new L.Control.Draw({
    draw: {
      polygon: true,
      rectangle: true,
      polyline: false,
      circle: false,
      circlemarker: false,
      marker: false
    },
    edit: {
      featureGroup: zonesLayer,
      edit: false,
      remove: true
    }
  });

  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, event => {
    zonesLayer.clearLayers();
    const drawnLayer = event.layer;
    zonesLayer.addLayer(drawnLayer);

    // Convertir la zone dessinée en objet GeoJSON pour Turf.js
    const zoneGeoJSON = drawnLayer.toGeoJSON();
    
    // Lancer l'analyse spatiale (ex: intersection avec les routes)
    analyserSelection(zoneGeoJSON);
  });
}


// 6. Traitement JavaScript / Turf.js sur les données
function analyserSelection(zone) {
  if (!routesLayer) return;

  // Réinitialiser le style des routes
  routesLayer.setStyle({
    color: "#3388ff",
    weight: 2,
    opacity: 0.8
  });

  let lignesSelectionnees = 0;

  // Parcourir chaque entité de la couche routes et tester l'intersection avec Turf.js
  routesLayer.eachLayer(ligne => {
    if (turf.booleanIntersects(ligne.feature, zone)) {
      ligne.setStyle({
        color: "#e53935", // Passage en rouge si sélectionné
        weight: 4,
        opacity: 1
      });
      lignesSelectionnees++;
    }
  });

  console.log(`${lignesSelectionnees} éléments de voirie interceptés par la zone dessinée.`);
}

// Écouter le changement de sélection du fichier GPX
document.getElementById('gpx-file').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const gpxText = event.target.result;

    // Supprimer une éventuelle trace GPX précédente
    if (window.gpxLayer) {
      map.removeLayer(window.gpxLayer);
    }

    // Afficher la nouvelle trace GPX avec le plugin leaflet-gpx
    window.gpxLayer = new L.GPX(gpxText, {
      async: true,
      marker_options: {
        startIconUrl: null,
        endIconUrl: null,
        shadowUrl: null
      },
      polyline_options: {
        color: '#ff9800', // Couleur orange pour le GPX
        weight: 4,
        opacity: 0.8
      }
    }).on('loaded', function(e) {
      // Centrer automatiquement la carte sur la trace GPX importée
      map.fitBounds(e.target.getBounds());

      // [NOUVEAU] Stocker les données GeoJSON du GPX et calculer la zone de sécurité
      currentGpxGeoJson = e.target.toGeoJSON();
      calculerEtAfficherZoneSecurite();
    }).addTo(map);
  };

  reader.readAsText(file);
});

// Fonction pour calculer et afficher la zone de sécurité avec Turf.js
function calculerEtAfficherZoneSecurite() {
  if (!currentGpxGeoJson) return;

  // Nettoyer l'ancienne zone de sécurité
  bufferLayer.clearLayers();

  // Utilisation de Turf.js pour créer un buffer autour de la trace (en mètres)
  const bufferedZone = turf.buffer(currentGpxGeoJson, currentRadius, { units: 'meters' });

  // Créer la couche Leaflet pour la zone de sécurité (Rouge / Rosé)
  const zonePolygonLayer = L.geoJSON(bufferedZone, {
    style: {
      color: "#d32f2f",        // Bordure rouge
      weight: 2,
      fillColor: "#ff8a80",    // Remplissage rosé
      fillOpacity: 0.35
    }
  });

  // Ajouter la couche au groupe dédié
  bufferLayer.addLayer(zonePolygonLayer);
}

// Écouter les modifications de l'interface graphique (ex: un <input type="range" id="radiusRange">)
document.getElementById('radiusRange').addEventListener('input', function(e) {
  currentRadius = parseFloat(e.target.value);
  
  // Optionnel : Mettre à jour un affichage texte de la valeur si vous en avez un (ex: <span id="radiusValue">)
  const radiusValueSpan = document.getElementById('radiusValue');
  if (radiusValueSpan) {
    radiusValueSpan.textContent = currentRadius;
  }

  // Recalculer et réafficher la zone dynamiquement
  calculerEtAfficherZoneSecurite();
});