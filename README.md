# AERIS — Aide à la préparation et à la coordination de missions de drones

AERIS est un prototype de dashboard cartographique réalisé pour le hackathon
Gendarmerie. Il aide un opérateur à préparer une mission, définir un secteur à
couvrir, répartir une flotte de drones et visualiser une proposition de
placement. L'interface porte aussi le nom **AIGLE** dans son en-tête.

L'application fonctionne entièrement dans le navigateur : il n'y a ni serveur
métier, ni compte utilisateur, ni base de données distante. Les missions et le
catalogue de drones sont enregistrés dans le stockage local du navigateur.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Parcours de préparation](#parcours-de-préparation)
- [Règles de calcul et de gestion de flotte](#règles-de-calcul-et-de-gestion-de-flotte)
- [Météo](#météo)
- [Carte et impression](#carte-et-impression)
- [Données et persistance](#données-et-persistance)
- [Lancer le projet](#lancer-le-projet)
- [Organisation du dépôt](#organisation-du-dépôt)
- [Dépendances et services externes](#dépendances-et-services-externes)
- [Périmètre et limites connues](#périmètre-et-limites-connues)

## Fonctionnalités

### Missions

- Créer, renommer, sélectionner et supprimer plusieurs missions.
- Conserver séparément, pour chaque mission, le tracé ou la zone, le stock et
  les télépilotes affectés, les paramètres de placement et les résultats.
- Réouvrir une mission enregistrée et retrouver son état dans le navigateur.

### Définition de la zone

Deux modes de préparation sont disponibles dans le panneau de configuration :

1. **Avec chemin** : importer un fichier GPX contenant au moins deux points de
   tracé. La carte se cadre ensuite sur le chemin. La zone protégée peut être
   constituée d'un buffer autour du tracé (de 50 à 1 000 m, 200 m par défaut)
   ou d'un polygone dessiné sur la carte.
2. **Sans chemin** : dessiner et valider un polygone d'au moins trois points.
   Ce mode calcule une estimation théorique de flotte à partir de la surface
   et des portées des drones, sans lancer le placement cartographique.

Dans le mode avec chemin, le tracé GPX et la zone protégée sont affichés sur la
carte. Le polygone dessiné peut également être utilisé comme zone de mission.
Le fichier GPX est lu dans le navigateur ; le projet ne téléverse pas le fichier
vers un serveur.

### Placement opérationnel

Le mode avec chemin permet de :

- gérer le stock par modèle et affecter des drones disponibles à des
  télépilotes ;
- renseigner l'identifiant, le nom et le modèle de chaque télépilote ;
- régler le rayon de couverture de chaque équipe, sans dépasser la portée du
  modèle, puis rétablir les rayons par défaut ;
- pondérer séparément l'importance du tracé et celle de la zone ;
- indiquer l'avancement de l'opération pour faire évoluer les priorités le long
  du chemin ;
- demander, facultativement, de minimiser les déplacements par rapport au
  placement précédent ;
- fixer un seuil maximal de chevauchement et lancer le calcul ;
- visualiser les cercles de couverture par drone, les intersections en rouge
  et la synthèse du placement (couverture pondérée, chemin, zone, chevauchement
  et équipes déplacées le cas échéant).

Un résultat est signalé comme à recalculer si les paramètres qui influencent
le placement changent.

### Catalogue des drones

Le panneau **Modèles de drones** permet de consulter, ajouter, modifier et
supprimer des modèles. Les propriétés enregistrées comprennent le nom, la
portée, la vitesse maximale de vent, le zoom maximal et les capacités
thermique, nocturne et de résistance à la pluie.

Le catalogue fourni dans `data/drones.js` contient :

| Modèle | Portée par défaut | Vent max. catalogue | Zoom max. | Vision thermique | Vision nocturne | Tolérance pluie |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Eagle M1 | 1 000 m | 45 km/h | 30 | Oui | Oui | Oui |
| Falcon X2 | 2 000 m | 55 km/h | 40 | Oui | Non | Oui |
| Scout S1 | 1 000 m | 35 km/h | 25 | Non | Non | Non |

Chaque mission commence avec un stock de trois Eagle M1 et deux Falcon X2
(Scout S1 : aucun exemplaire). Aucun télépilote n'est préaffecté. Le stock peut
être modifié dans l'interface, sous réserve de ne pas descendre sous le nombre
d'exemplaires déjà affectés.

## Parcours de préparation

1. Ouvrir le panneau **Configuration** et choisir **Avec chemin** ou **Sans
   chemin**.
2. Importer un GPX ou dessiner un polygone en cliquant sur la carte, puis
   valider le contour.
3. En mode avec chemin, choisir le buffer du tracé ou le polygone comme zone
   protégée. En mode sans chemin, consulter la surface calculée et choisir le
   taux de couverture cible.
4. Vérifier et ajuster les stocks de drones. Pour un placement, affecter un
   télépilote à chaque drone à utiliser.
5. Ajuster si nécessaire les rayons, les pondérations, l'avancement de
   l'opération, l'option de déplacement des équipes et le seuil de collision.
6. En mode avec chemin, sélectionner **Calculer le placement**. Le résultat
   apparaît sur la carte et dans le panneau.
7. Si besoin, ouvrir **Options de la carte** pour basculer le fond de carte ou
   lancer l'analyse météo.

Les panneaux latéraux sont escamotables et déplaçables. Les contrôles de carte
permettent de zoomer et de régler la sensibilité du zoom.

## Règles de calcul et de gestion de flotte

### Placement sur la carte

Le moteur de placement de `src/drones.js` est un optimiseur heuristique de
couverture pondérée :

1. Il projette localement les coordonnées géographiques en mètres et construit
   des points de demande à couvrir.
2. Les points sur le GPX sont prioritaires. Autour du chemin, le poids décroît
   avec la distance ; le polygone est pondéré selon le paramètre de zone.
3. L'avancement de l'opération fait varier les poids autour du front de
   progression, en favorisant le chemin à traiter et à anticiper.
4. Une phase gloutonne place les télépilotes là où le gain de couverture est
   maximal. Une recherche locale puis un raffinement améliorent ensuite les
   positions.
5. Si l'option de minimisation des déplacements est activée, le moteur tient
   compte des positions du calcul précédent et pénalise les déplacements qui
   n'apportent pas un gain suffisant.

Les rayons utilisés sont ceux des télépilotes affectés. Le calcul est refusé
si aucun tracé ou polygone exploitable n'est défini, si aucun télépilote n'est
affecté, si le stock est dépassé, si un rayon dépasse la portée de son drone
ou si le chevauchement maximal obtenu dépasse le seuil configuré (0 à 100 %).
Le chevauchement affiché correspond à la plus grande intersection mesurée par
rapport à la surface du plus petit des deux disques concernés.

### Dimensionnement sans chemin

Cette estimation utilise l'aire théorique d'un disque, π × portée². Elle
compare le nombre de drones et de télépilotes nécessaire par modèle et propose
aussi, si plusieurs portées existent, un scénario de flotte mixte composé des
modèles de portée la plus courte et la plus longue, selon une cible théorique
80/20.

Le taux demandé est compris entre 50 et 100 % (80 % par défaut ; raccourcis
80 %, 90 % et 100 %). Les résultats comparent le besoin théorique au stock et
au nombre de télépilotes actuellement affectés. Ce calcul ne réserve pas de
drones et ne remplace pas l'optimisation cartographique.

### Contraintes de saisie

- Maximum de 30 télépilotes affectés par mission.
- Le nom d'un télépilote est limité à 30 caractères et son identifiant à 12
  caractères ; les identifiants doivent être uniques dans la flotte.
- Rayon de couverture minimal : 200 m ; réglage par pas de 50 m ; maximum égal
  à la portée du drone affecté.
- Le stock est saisi en nombres entiers, entre le nombre déjà affecté et 30
  exemplaires par modèle.
- Le contour manuel doit comporter au moins trois points.
- Le parseur GPX attend des points de tracé (`trkpt`) et au moins deux
  coordonnées valides.

## Météo

Le panneau **Options de la carte** permet de demander une analyse météo sur la
zone protégée. L'application découpe l'emprise de la zone en une grille de 2 à
15 cellules par côté. Elle ne récupère les conditions que pour les cellules
dont le centre tombe à l'intérieur de la zone. La progression est affichée et
les résultats sont superposés à la carte. Cliquer sur une cellule ouvre une
fiche contenant température, vent moyen, rafales, précipitations, pression,
indice Kp, tendance et compatibilité indicative de drones.

Les données météorologiques courantes et les prévisions horaires de vent et de
précipitations proviennent de l'API publique Open-Meteo. Les appels sont faits
cellule par cellule ; une grille plus fine peut donc prendre davantage de
temps. Les cellules sans réponse exploitable sont signalées sans supprimer les
résultats déjà obtenus.

**Limite importante :** l'indice Kp affiché est actuellement simulé, et la
compatibilité météo est calculée pour trois modèles DJI définis dans le module
de scan. Elle n'est pas raccordée aux caractéristiques personnalisables du
catalogue AERIS et ne doit pas être considérée comme une validation
opérationnelle.

## Carte et impression

- Fond OpenStreetMap et imagerie satellite Esri.
- Carte centrée par défaut sur le secteur de Mirepoix (coordonnées définies
  dans `ui/config.js`).
- Cadrage automatique sur le GPX ou le polygone ; zoom manuel et réglage de
  sensibilité.
- Dessin de polygone directement par clics sur la carte.
- Cercles de placement colorés selon le modèle ; les intersections sont
  signalées en rouge.
- Action **Exporter / Imprimer** qui ouvre la boîte d'impression du navigateur.
  Elle permet notamment d'imprimer ou d'enregistrer la vue en PDF ; elle ne
  génère pas de fichier de données GPX, GeoJSON ou CSV.

## Données et persistance

Les clés du stockage local du navigateur sont :

- `aeris-missions` : missions et paramètres de planification ;
- `aeris-drone-models` : modèles du catalogue.

Les données restent liées au navigateur et au profil utilisateur de la
machine. Elles ne sont pas synchronisées entre utilisateurs, navigateurs ou
ordinateurs. Effacer les données du site peut supprimer les missions et les
modèles enregistrés. Le GPX importé et les résultats liés à la mission sont
stockés dans le navigateur avec les données de mission.

## Lancer le projet

Le dépôt ne contient pas de chaîne de compilation ni de manifeste npm. Il n'y a
pas de commande `build` à exécuter : l'interface est constituée de modules
JavaScript natifs chargés par `index.html`.

1. Cloner ou télécharger le dépôt.
2. Ouvrir le dossier avec Visual Studio Code.
3. Servir le dossier à l'aide d'un serveur HTTP statique, par exemple avec
   l'extension VS Code **Live Server**.
4. Ouvrir `index.html` depuis ce serveur (et non directement en `file://`) dans
   un navigateur récent.

Une connexion Internet est nécessaire pour les bibliothèques chargées par CDN,
les fonds de carte et l'API météo. Le placement et la gestion des missions sont
exécutés côté navigateur.

## Organisation du dépôt

```text
.
├── index.html                  # Page d'entrée, bibliothèques CDN et styles globaux
├── data/
│   └── drones.js               # Catalogue initial des modèles
├── src/
│   ├── drones.js               # Moteur d'optimisation de placement
│   ├── testCharles.html        # Prototype cartographique autonome
│   └── testCharles.js          # Chargement GeoJSON et essais de dessin/intersection
├── ui/
│   ├── app.js                  # Initialisation et rendu de l'application
│   ├── components.js           # Structure HTML des panneaux et composants
│   ├── config.js               # Configuration et sélecteurs de carte
│   ├── dom.js                  # Helpers DOM
│   ├── events.js               # Interactions, formulaires et transitions
│   ├── icons.js                # Icônes SVG
│   ├── map.js                  # Carte Leaflet, fonds et polygones
│   ├── state.js                # État et persistance locale
│   ├── planning/               # GPX, zones, flotte, estimation et placement
│   ├── weather/                # API, scan météo et fiches de cellule
│   └── images/                 # Logo de la Gendarmerie
├── chemins/                    # Exemples de fichiers GPX
├── cartes/                     # Données/cartes GeoJSON et ressources cartographiques
└── doc/                        # Briefs, cahier des charges et checklist
```

Le prototype `src/testCharles.html` est indépendant du dashboard principal. Il
explore notamment le chargement des GeoJSON de Toulouse, le dessin de zones et
la détection d'intersections avec les routes. Les fichiers de `cartes/` et
`chemins/` sont des ressources/exemples ; l'application principale n'importe
pas automatiquement ces couches ni ces GPX au démarrage.

### Modules de planification

- `ui/planning/gpx.js` : lecture et validation du GPX.
- `ui/planning/area.js` : construction de la zone protégée, mesure et cadrage.
- `ui/planning/fleet.js` et `fleet-panel.js` : stock, affectations et édition
  des télépilotes.
- `ui/planning/radius-editor.js` : réglage du rayon depuis les cercles de la
  carte.
- `ui/planning/calculator.js` : estimation théorique du nombre de drones sans
  chemin.
- `ui/planning/placement.js` : appel du moteur, rendu des couvertures et calcul
  des chevauchements.

### Modules météo

- `ui/weather/api.js` : requêtes vers Open-Meteo.
- `ui/weather/scanner.js` : parcours de la grille, progression et cellules
  cartographiques.
- `ui/weather/popup.js` : contenu des fiches météo.

## Dépendances et services externes

Les bibliothèques front-end sont chargées directement depuis des CDN dans
`index.html` :

- **Leaflet 1.9.4** : carte et couches cartographiques ;
- **Tailwind CSS** : styles utilitaires, via le CDN Tailwind ;
- **Turf.js 7** : buffers, surfaces, intersections et tests géométriques.

Services utilisés à l'exécution :

- tuiles **OpenStreetMap** pour le fond Plan 2D ;
- imagerie **Esri** pour le fond satellite ;
- API de prévisions **Open-Meteo** pour l'analyse météo.

Les conditions d'utilisation et d'attribution de ces services restent
applicables. Sans accès réseau, les ressources distantes (bibliothèques,
tuiles et météo) peuvent être indisponibles.

## Périmètre et limites connues

- Il s'agit d'un outil d'aide à la préparation, pas d'un système de pilotage ni
  de suivi GPS de drones en temps réel.
- Le placement est une proposition calculée à partir des géométries, portées
  et pondérations saisies. Il ne modélise pas le relief, les obstacles, les
  contraintes réglementaires ou la disponibilité réelle des équipes.
- Le dimensionnement sans chemin repose sur des disques théoriques ; la forme
  de la zone et le chevauchement peuvent augmenter le besoin réel.
- L'analyse météo ne remplace pas une validation opérationnelle : son indice
  Kp est simulé et ses règles de compatibilité sont indépendantes du catalogue
  configurable.
- La persistance étant locale, il n'y a ni partage de mission, ni
  authentification, ni historique centralisé.
- L'impression est une sortie visuelle du navigateur, pas un export métier.
- Les fichiers `src/testCharles.*` sont un prototype séparé et ne font pas
  partie du parcours principal AERIS.

La documentation de cadrage est disponible dans `doc/`, et la documentation
spécifique aux modules de l'interface dans [`ui/README.md`](ui/README.md).
