# Cahier des charges — UI du dashboard de coordination de drones

**Projet :** Hackathon Gendarmerie  
**Version :** 1.0 — 14 octobre 2026  
**Statut :** Proposition de cadrage MVP  
**Périmètre :** Interface utilisateur du dashboard de préparation et de coordination d’une mission de drones

## 1. Contexte et objectif

Le dashboard doit aider un opérateur à décider rapidement des moyens nécessaires à une mission, puis à coordonner leur emploi en tenant compte des contraintes propres à chaque drone.

Le produit reçoit notamment :

- le type de drone et sa distance de déploiement ;
- le nombre de drones disponibles.

Il restitue :

- les emplacements optimaux permettant de couvrir un maximum de territoire ;
- une représentation lisible de la couverture et des zones non couvertes ;
- la répartition opérationnelle de chaque drone.

La carte de référence est le secteur de Mirepoix et ses environs, fourni par le brief du hackathon et basé sur OpenStreetMap.

## 2. Utilisateurs cibles

### Utilisateur principal — Opérateur de mission

Personne chargée de préparer le dispositif, de vérifier les moyens disponibles et de transmettre une consigne exploitable aux équipes terrain.

### Utilisateur secondaire — Superviseur

Personne qui consulte le dispositif proposé, vérifie sa cohérence et compare plusieurs configurations avant validation.

## 3. Périmètre du MVP

### Inclus

1. Saisie d’une configuration de mission.
2. Sélection de la zone d’intervention sur la carte.
3. Prise en compte du type, de la portée et du nombre de drones disponibles.
4. Lancement d’une optimisation de couverture.
5. Affichage des positions recommandées.
6. Visualisation de la couverture par drone et de la couverture globale.
7. Consultation des caractéristiques et contraintes de chaque drone.
8. Validation et partage visuel d’un dispositif.
9. Gestion des états vides, de chargement, d’erreur et de résultat impossible.

### Hors périmètre du MVP

- pilotage réel d’un drone ;
- suivi GPS temps réel ;
- gestion des comptes, rôles et habilitations ;
- planification pluri-mission ;
- météo, relief et obstacles réglementaires détaillés ;
- export juridiquement engageant ou intégration à un système métier existant.

Ces sujets pourront faire l’objet d’une version ultérieure.

## 4. Principes UX et UI

- **Décision d’abord :** l’utilisateur doit comprendre quoi faire et obtenir une recommandation sans parcourir plusieurs écrans.
- **Carte comme espace principal :** la carte occupe la majorité de l’écran et reste visible pendant la consultation des résultats.
- **Lecture opérationnelle :** les informations critiques sont visibles en moins de quelques secondes : nombre de drones, couverture obtenue, zones non couvertes et alertes.
- **Progressivité :** les paramètres avancés ne doivent pas surcharger la première vue.
- **Traçabilité visuelle :** chaque position recommandée doit être associée à un drone identifiable.
- **Robustesse terrain :** contrastes élevés, contrôles suffisamment grands et fonctionnement utilisable sur un écran d’ordinateur portable.
- **Neutralité cartographique :** les couleurs de l’interface ne doivent pas masquer les routes, bâtiments, cours d’eau ou limites de la carte.

## 5. Structure de l’écran

### 5.1 En-tête global

L’en-tête contient :

- le nom du produit ;
- le contexte ou nom de la mission ;
- l’état de la mission : `Brouillon`, `Calcul en cours`, `Résultat disponible` ou `À vérifier` ;
- une action principale `Nouvelle mission` ;
- une action de validation ou de partage lorsque le résultat est disponible.

### 5.2 Panneau de configuration

Un panneau latéral fixe ou escamotable contient le formulaire de préparation :

- nom ou identifiant de mission ;
- zone d’intervention ;
- nombre de drones disponibles ;
- liste des drones, avec pour chacun :
  - identifiant ;
  - type ;
  - distance de déploiement ou portée opérationnelle ;
  - statut de disponibilité ;
  - contraintes éventuelles ;
- objectif d’optimisation, avec `Maximiser la couverture` sélectionné par défaut ;
- bouton principal `Calculer le dispositif`.

Le bouton de calcul est désactivé tant que les données minimales ne sont pas valides. Les erreurs sont affichées au niveau du champ concerné, avec un résumé lisible en haut du formulaire.

### 5.3 Zone cartographique

La carte constitue la zone centrale du dashboard. Elle doit afficher :

- le fond cartographique du secteur ;
- la zone de mission ;
- les positions de déploiement proposées ;
- le rayon ou polygone de couverture de chaque drone ;
- la couverture globale agrégée ;
- les zones non couvertes ou insuffisamment couvertes ;
- les points d’intérêt utiles à la compréhension du dispositif ;
- une légende repliable ;
- les contrôles de zoom, recentrage et retour à l’emprise de mission.

Les éléments cartographiques doivent être différenciables par la couleur, la forme et le libellé ; la couleur seule ne doit pas porter une information critique.

### 5.4 Panneau de résultats

Après calcul, un panneau de synthèse présente :

- le taux de couverture estimé ;
- la surface couverte et la surface restante, si ces données sont disponibles ;
- le nombre de drones utilisés et non utilisés ;
- les alertes ou compromis identifiés ;
- la liste des positions recommandées ;
- les actions `Modifier la configuration`, `Recalculer` et `Valider le dispositif`.

Un clic sur une position ou sur une carte de drone doit centrer la carte sur l’élément correspondant et le mettre en évidence.

## 6. Parcours utilisateurs principaux

### Parcours P1 — Préparer et calculer un dispositif

1. L’opérateur ouvre le dashboard.
2. Il crée une nouvelle mission ou renseigne le contexte de la mission.
3. Il délimite ou confirme la zone d’intervention.
4. Il renseigne le nombre de drones disponibles.
5. Il sélectionne le type et la portée de chaque drone.
6. Il lance le calcul.
7. Le dashboard affiche la configuration optimale, la couverture et les alertes.

**Critère de réussite :** l’opérateur peut passer d’un dashboard vierge à un résultat compréhensible sans assistance.

### Parcours P1 — Comprendre la recommandation

1. Le superviseur consulte le taux de couverture global.
2. Il identifie les zones couvertes et non couvertes sur la carte.
3. Il sélectionne un drone pour consulter sa zone et ses contraintes.
4. Il vérifie que chaque position est compatible avec la mission.
5. Il valide ou demande une modification de la configuration.

### Parcours P2 — Comparer une configuration

1. L’opérateur modifie le nombre ou le type de drones.
2. Il relance le calcul.
3. Le dashboard met à jour les résultats.
4. Les différences principales sont visibles : couverture, nombre de drones utilisés et alertes.

### Parcours P2 — Gérer un calcul impossible

Si les données sont incomplètes, incohérentes ou ne permettent pas de produire une solution, le dashboard explique la cause et indique l’action corrective attendue. Il ne doit jamais afficher un résultat présenté comme valide lorsque le calcul a échoué.

## 7. Exigences fonctionnelles

- **REQ-001** : L’interface DOIT permettre de créer une mission et de renseigner son nom ou identifiant.
- **REQ-002** : L’interface DOIT permettre de définir ou de confirmer la zone géographique de la mission sur la carte.
- **REQ-003** : L’interface DOIT permettre de renseigner le nombre de drones disponibles.
- **REQ-004** : L’interface DOIT permettre de sélectionner un type de drone et d’afficher sa distance de déploiement ou sa portée opérationnelle.
- **REQ-005** : L’interface DOIT permettre d’associer à chaque drone un identifiant et un statut de disponibilité.
- **REQ-006** : L’interface DOIT signaler les champs obligatoires manquants et les valeurs incohérentes avant le lancement du calcul.
- **REQ-007** : L’utilisateur DOIT pouvoir lancer un calcul d’optimisation depuis un bouton d’action clairement identifiable.
- **REQ-008** : Pendant le calcul, l’interface DOIT afficher un état de chargement et empêcher le lancement accidentel de calculs concurrents.
- **REQ-009** : À la fin d’un calcul réussi, l’interface DOIT afficher les positions recommandées sur la carte.
- **REQ-010** : L’interface DOIT représenter la couverture de chaque drone et la couverture globale de la mission.
- **REQ-011** : L’interface DOIT afficher un indicateur de couverture globale et, lorsque disponible, les surfaces couverte et non couverte.
- **REQ-012** : L’interface DOIT distinguer visuellement les zones couvertes, partiellement couvertes et non couvertes.
- **REQ-013** : L’utilisateur DOIT pouvoir sélectionner un drone depuis la carte ou la liste de résultats et voir sa zone de couverture mise en évidence.
- **REQ-014** : L’interface DOIT afficher les contraintes ou alertes associées à un drone ou à une position recommandée.
- **REQ-015** : L’utilisateur DOIT pouvoir modifier la configuration et relancer le calcul sans perdre le contexte de mission.
- **REQ-016** : L’interface DOIT permettre de valider le dispositif affiché après consultation des résultats.
- **REQ-017** : L’interface DOIT proposer une légende expliquant les couleurs, symboles, rayons et statuts utilisés sur la carte.
- **REQ-018** : L’interface DOIT afficher un état vide explicite avant le premier calcul, avec une consigne indiquant les prochaines étapes.
- **REQ-019** : En cas d’échec du calcul, l’interface DOIT afficher un message compréhensible, conserver la configuration saisie et proposer une action corrective.
- **REQ-020** : L’interface NE DOIT PAS présenter une recommandation obsolète comme résultat courant après modification des paramètres ; le résultat doit être marqué comme à recalculer.
- **REQ-021** : L’interface DOIT permettre le zoom, le dézoom, le recentrage et le retour à l’emprise de la mission.
- **REQ-022** : L’interface DOIT conserver une hiérarchie visuelle claire sur une résolution d’ordinateur portable courante, sans masquer le formulaire ou les résultats essentiels.

## 8. Règles de validation métier affichées par l’UI

- Le nombre de drones doit être un entier strictement positif et ne peut pas dépasser le parc disponible.
- Chaque drone utilisé dans le calcul doit avoir un type et une portée renseignés.
- Une mission sans zone définie ne peut pas être calculée.
- Une configuration modifiée après calcul doit être marquée `À recalculer`.
- Une position recommandée hors de la zone de mission doit être signalée.
- Si la couverture maximale théorique n’est pas atteinte, l’interface doit afficher le compromis au lieu de masquer l’écart.
- Les drones indisponibles ne doivent pas être comptabilisés comme moyens mobilisables.

## 9. États d’interface à concevoir

L’équipe UI doit produire une maquette pour chacun des états suivants :

1. **Initial / vide** : aucune mission configurée.
2. **Formulaire en cours de saisie** : validation des champs et aides contextuelles.
3. **Calcul en cours** : progression ou indicateur d’activité, contrôles concernés désactivés.
4. **Résultat nominal** : carte, couverture, liste des drones et synthèse.
5. **Résultat partiel** : zones non couvertes et compromis explicites.
6. **Erreur de validation** : erreurs de saisie localisées.
7. **Erreur de calcul** : échec explicite, configuration conservée.
8. **Résultat obsolète** : paramètres modifiés depuis le dernier calcul.
9. **Mission validée** : état non ambigu et possibilité de revenir à la consultation.

## 10. Design system attendu

### Couleurs et statuts

Les couleurs doivent être cohérentes et accompagnées d’un libellé ou d’un motif :

- couverture satisfaisante ;
- couverture partielle ;
- zone non couverte ;
- alerte ou contrainte ;
- drone sélectionné ;
- drone indisponible ;
- information neutre.

Éviter les aplats trop opaques sur la carte. La couverture doit rester lisible sans empêcher l’identification des routes et bâtiments.

### Composants à prévoir

- bouton primaire, secondaire et destructif si nécessaire ;
- champs numériques et listes de sélection ;
- cartes de drones ;
- badges de statut ;
- indicateurs de couverture ;
- panneau latéral ;
- infobulle ;
- alerte inline et notification globale ;
- légende cartographique ;
- modal ou panneau de confirmation de validation ;
- skeleton ou indicateur de chargement.

## 11. Responsive et accessibilité

Le MVP est prioritairement conçu pour un écran desktop ou un ordinateur portable, avec une largeur cible d’au moins 1280 px. Une adaptation tablette doit rester fonctionnelle :

- le panneau de configuration peut devenir escamotable ;
- la carte reste accessible sans défilement horizontal ;
- les résultats peuvent passer sous la carte ;
- les contrôles tactiles doivent rester suffisamment espacés.

Exigences minimales :

- contraste lisible pour les textes et contrôles ;
- navigation clavier des champs et actions principales ;
- focus visible ;
- libellés explicites, non dépendants de la couleur ;
- textes d’erreur associés au champ concerné ;
- taille de texte et de contrôle lisible en conditions opérationnelles.

## 12. Livrables UI attendus

1. Arborescence ou wireflow du dashboard.
2. Maquette haute fidélité de l’écran nominal.
3. Maquettes des neuf états listés au §9.
4. Prototype cliquable des parcours P1.
5. Spécification des composants et tokens visuels.
6. Légende cartographique et règles d’affichage des couches.
7. Tableau de correspondance entre exigences `REQ-XXX` et écrans ou composants.
8. Jeu de données fictif permettant de démontrer au moins :
   - une couverture complète ou quasi complète ;
   - une couverture partielle ;
   - un drone indisponible ;
   - une erreur de saisie ;
   - un calcul impossible.

## 13. Critères d’acceptation UI

- **CA-001** : Sur une configuration valide, un opérateur identifie l’action de calcul sans explication orale.
- **CA-002** : Après un calcul réussi, l’utilisateur distingue en un coup d’œil la couverture globale, les zones non couvertes et les positions des drones.
- **CA-003** : La sélection d’un drone dans la liste met en évidence le même drone sur la carte et inversement.
- **CA-004** : Toute erreur de saisie est rattachée au champ concerné et formulée en français compréhensible.
- **CA-005** : Une modification de configuration rend visible que le résultat précédent doit être recalculé.
- **CA-006** : Un calcul en cours ne peut pas être déclenché plusieurs fois par des clics répétés.
- **CA-007** : En cas d’échec, les données saisies restent disponibles et une action corrective est proposée.
- **CA-008** : La légende permet à un nouvel utilisateur de comprendre les couches principales sans documentation externe.
- **CA-009** : Les parcours P1 sont réalisables au clavier et avec un contraste suffisant.
- **CA-010** : Le prototype est compréhensible sur une résolution de 1280 × 800 px sans masquer la carte ou l’action principale.

## 14. Critères de succès

- **SC-001** : Au moins 90 % des utilisateurs testeurs lancent correctement un premier calcul sans aide.
- **SC-002** : Un utilisateur entraîné configure une mission simple en moins de 2 minutes.
- **SC-003** : Au moins 90 % des utilisateurs testeurs identifient la zone la moins couverte en moins de 10 secondes après affichage du résultat.
- **SC-004** : 100 % des états fonctionnels listés au §9 disposent d’une représentation UI validée avant développement.
- **SC-005** : Aucun test de saisie invalide ne conduit à l’affichage d’un résultat présenté comme valide.
- **SC-006** : La sélection d’un drone met à jour la mise en évidence correspondante sur la carte en moins d’une seconde dans le prototype.
- **SC-007** : Le parcours principal reste réalisable sur un écran de 1280 × 800 px sans défilement horizontal.

## 15. Hypothèses et décisions à confirmer

- Le MVP cible un opérateur authentifié dans une application web utilisée sur ordinateur portable.
- Le calcul d’optimisation est fourni par un service existant ou à venir ; le cahier des charges décrit son affichage et ses états, pas son algorithme.
- Les distances de déploiement sont exprimées dans une unité unique et affichée explicitement à l’utilisateur.
- La carte de démonstration est centrée sur Mirepoix, avec possibilité de recentrer la vue sur la zone de mission.
- Les données affichées dans le prototype peuvent être fictives, à condition de représenter les cas nominaux et d’erreur.
- La validation du dispositif signifie une validation dans l’interface ; elle ne déclenche pas encore le pilotage ou l’envoi d’ordres à un drone.

