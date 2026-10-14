# Interface utilisateur AERIS

Ce dossier contient uniquement le code de l'interface graphique de la dashboard.

## Organisation

- `app.js` : point d'entrée UI et cycle de rendu.
- `components.js` : composants HTML de l'interface.
- `config.js` : constantes, sélecteurs et configuration cartographique.
- `dom.js` : helpers DOM partagés.
- `events.js` : écouteurs des contrôles et transitions d'état.
- `icons.js` : icônes SVG utilisées par les composants.
- `map.js` : initialisation Leaflet, navigation et zone de mission.
- `weather/api.js` : recherche géographique et appels Open-Meteo.
- `weather/scanner.js` : scan de grille, couches Leaflet et progression.
- `weather/popup.js` : contenu des détails météo et compatibilité des drones.
- `state.js` : état local de l'interface.

## Intégration

L'interface est chargée comme module ES natif depuis [index.html](../index.html) :

```html
<script type="module" src="ui/app.js"></script>
```

Les autres domaines fonctionnels peuvent donc évoluer dans leurs propres dossiers
sans ajouter leur logique au point d'entrée de l'interface.
