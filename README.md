# Aeris - gestion d'une flotte de drones en opération

## Objectifs
Objectif 1 : La gagne

But 1 : Décider les moyens nécessaires à une mission.

  Données in :
  
    Type de drone ( distance de déploiement )
   
    Nombre de drone disponible
    
  Données out : 
  
    Emplacement optimal pour couvrir un max d'espace

But 2 : Coordonner l'emploi en prenant en compte les contraintes de chaque drone.

## Fonctionnement de la carte

- Le stock est géré par modèle de drone. Un télépilote doit être affecté à un drone disponible pour participer au calcul.
- Le rayon de couverture proposé par défaut correspond à la portée du drone affecté. Un rayon personnalisé supérieur est refusé.
- Le placement tient compte de la couverture du chemin et de la zone, de l'avancement de l'opération et du seuil maximal de chevauchement autorisé.
- L'option de minimisation des déplacements réutilise les positions du dernier calcul et ne déplace une équipe que si le gain de couverture le justifie.
- Le fond de carte peut être basculé entre OpenStreetMap et satellite. La gestion des modèles, les exports et l'analyse météo restent disponibles.

## Carte 
Pour récupérer la carte 
https://www.openstreetmap.org/relation/1374163#map=15/43.08714/1.86789
