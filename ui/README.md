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
- `planning/gpx.js` : lecture des fichiers GPX importés par l'utilisateur.
- `planning/area.js` : tracé GPX, buffer ou polygone de protection et cadrage de la carte.
- `planning/placement.js` : orchestration du calcul de placement et rendu des couvertures/collisions.
- `restrictions/scanner.js` : analyse OSM des restrictions et du terrain, avec couches filtrables sur la carte.
- `state.js` : état local de l'interface.

## Intégration

L'interface est chargée comme module ES natif depuis [index.html](../index.html) :

```html
<script type="module" src="ui/app.js"></script>
```

Les autres domaines fonctionnels peuvent donc évoluer dans leurs propres dossiers
sans ajouter leur logique au point d'entrée de l'interface.

## Planification et météo

Le GPX importé est la source de vérité géographique de la mission. Il est affiché
sur la carte puis utilisé pour créer un buffer de protection. L'utilisateur peut
aussi choisir un polygone manuel. Le scan météo utilise les coordonnées de cette
zone protégée et ne dépend plus d'une recherche de ville ni de données statiques.

Le moteur de placement historique reste dans [../src/drones.js](../src/drones.js),
mais son panneau HTML automatique a été supprimé. L'UI AERIS lui transmet les
paramètres et affiche ses résultats dans le panneau de configuration.
Après un premier placement, chaque drone peut être bloqué ou autorisé à bouger
depuis le panneau de résultats. Une replanification conserve la position des
drones bloqués et peut repositionner les autres.
Après un scan des restrictions, le placement évite les secteurs OSM classés
comme ZIT, zones nécessitant une autorisation, lacs ou forêts. Les cases
d’autorisation pour ZIT et zones jaunes ne doivent être cochées qu’après
obtention d’une autorisation officielle. Les données OSM et cette sélection ne
valident pas la légalité du vol : vérifier les sources officielles reste
indispensable. Sans scan, le placement ne peut pas filtrer les restrictions.

## Restrictions et terrain

Le panneau « Options de la carte » permet de scanner une ville ou le centre de
la carte sur un rayon configurable, puis d’afficher ou filtrer les secteurs
classés à partir des données OpenStreetMap. Ces données sont indicatives et ne
remplacent pas la vérification des restrictions UAS officielles sur Géoportail.
