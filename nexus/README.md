# NEXUS Ambient Display

## Météo

Le widget **Atmosphère** utilise les services Open-Meteo, sans clé API :
- recherche de ville via le service de géocodage ;
- météo actuelle : température, ressenti, état du ciel et vitesse du vent ;
- actualisation manuelle et automatique toutes les 30 minutes ;
- conservation de la dernière mesure dans `localStorage` sous `nexus.weather-cache.v1` ;
- affichage de la dernière mesure connue lorsque la connexion est absente.

La première recherche et l'actualisation nécessitent une connexion Internet. La page doit être servie depuis HTTPS ou depuis `localhost` pour que les API du navigateur fonctionnent correctement.

## Personnaliser les widgets

Ouvre **Widgets** dans la barre supérieure, ou utilise le bouton ⚙ d'une carte.

Pour chaque disposition, Portrait et Paysage, tu peux :
- afficher ou masquer chaque widget ;
- régler sa largeur (1, 2 ou 3 colonnes selon l'orientation) ;
- choisir une hauteur compacte, normale ou étendue ;
- changer son ordre avec les flèches haut/bas.

Les modifications sont enregistrées automatiquement dans le stockage NEXUS. Les deux orientations sont indépendantes.

## Migration des réglages

Le stockage passe au schéma `nexus.state.v3`. Les configurations `nexus.state.v2` et `nexus.state.v1` sont migrées automatiquement en conservant leurs préférences, leurs dispositions, les villes météo et les fragments personnels lorsqu'ils existent. Le cache météo et la base audio locale ne sont pas effacés.

## Vérifications

Les tests Node se lancent depuis ce dossier :

```sh
node --test js/*.test.mjs
```
