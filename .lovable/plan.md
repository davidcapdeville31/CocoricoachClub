# Calendrier athlète premium — refonte ciblée

## Audit terminé
Le calendrier réel de Manon a été consulté sur smartphone : confirmations, actions et conteneurs imbriqués repoussent les dates hors écran. Les événements sont répétés et défilent dans une seconde zone ; les indicateurs de dates cumulent fonds, contours et ombres. « Calendrier » devient une icône sur mobile et « Planification » est abrégé. Le code révèle aussi des boutons imbriqués et des motifs d’absence sans libellé associé.

## Résultat à construire
1. **En-tête compact** : « Mon calendrier », sélecteur explicite **Calendrier | Planification** ; conserver le contexte des dates lors des allers-retours sans changer les destinations de navigation.
2. **Dates immédiatement visibles** : grille sept colonnes, lundi premier, mois/année, précédent/suivant, **Aujourd’hui**, **Mois | Semaine** sur les mêmes données. Préférence de vue uniquement, sans stocker de réponses sensibles. Jour courant et date sélectionnée distincts.
3. **Repères discrets** : petits indicateurs par catégorie, regroupés sans masquer les chiffres ; descriptions accessibles pour dates et événements. Entraînement bleu, compétition rouge, séance personnelle violet, Wellness vert/orange ; prévention, réhab et cycles conservés.
4. **Événements du jour compacts** : surfaces opaques et un seul cadre par événement, titre/type/horaire/statut prioritaires, détails secondaires dépliables. **Présent / Absent, Voir la séance / Remplir les données restent accessibles sans ouvrir la carte**, conformément à la demande précédente. Aucune association automatique entre présence et réalisation.
5. **Informations secondaires après les événements** : raccourci au nombre réel de présences non renseignées, prochaines dates consultables dans un panneau repliable, sans répétition de la journée ouverte ; cycles synthétiques dépliables. Wellness compact avec accès au questionnaire et aux données existantes ; grand bandeau de l’accueil inchangé.
6. **Actions conservées** : Ajouter une séance et Récupération dans une rangée compacte après la grille/liste, avec les mêmes fenêtres et sauvegardes. Supprimer le défilement interne de la liste du jour et préserver l’espace mesuré au-dessus de la navigation basse.
7. **Présences fiables** : mêmes destinations d’écriture, règles et délais ; sélection verte/rouge conservée dans les deux thèmes, motif facultatif uniquement pour Absent, brouillon local préservé lors d’un changement temporaire. Confirmation uniquement après sauvegarde réelle, erreurs explicites, protection contre double clic et correction possible. Ne pas modifier silencieusement le contrat existant des commentaires stockés.

## Mise en œuvre par étapes
- Réorganiser la page et extraire les éléments de présentation réutilisables propres au calendrier athlète, sans réécrire tous les modules.
- Remplacer les indicateurs contradictoires par un mapping sémantique centralisé et ajouter les commandes de navigation.
- Compacter cartes et présences ; traiter les boutons imbriqués, libellés, chargements et erreurs dans le périmètre concerné.
- Vérifier chaque étape dans l’aperçu, puis consigner les résultats réellement obtenus.

## Détails techniques et limites de périmètre
- Réutiliser React Day Picker, TanStack Query, les clés de cache et les données actuelles. Les fenêtres métier multisports et leur sauvegarde restent inchangées.
- Pas de migration, nouveau statut métier, modification des permissions, calculs RPE/Wellness ou contenus coach. Pas de refonte des calendriers coach ni des styles du Calendar partagé ; variantes scoped athlète.
- Éviter les requêtes par carte pour les seuls résumés de présence lorsque les réponses peuvent être regroupées ; ne pas limiter arbitrairement l’historique chargé et visible. Présences basées sur les tables actuelles, jamais sur les compositions.
- Réutiliser les tokens et FieldModeContext : sélection bleu marine/blanc en clair, blanc/bleu marine en sombre ; exceptions fonctionnelles présence, Wellness, RPE et bowling conservées. Aucun fond transparent indésirable.
- Dates civiles traitées localement, sans conversion UTC ; tests du changement de mois/année, lundi, février bissextile, compétition multi-jours et transitions horaires. Prévention/réhab gardent leurs règles actuelles.
- L’audit global des contrastes reste ouvert et distinct ; ce travail n’annonce pas une validation de toute l’application.

## Vérifications et compte rendu
- **Navigation réelle** : mois précédent/suivant, jour sélectionné, Aujourd’hui, semaine/mois, Planification/Calendrier, journée vide et plusieurs événements.
- **Fonctions** : ouvrir détails, bilan, Wellness, récupération et ajout de séance ; conserver les modules spécifiques bowling/judo et les autres disciplines.
- **Présences** : sans réponse, Présent, Absent, motif, correction, rechargement et erreur réseau ; enregistrement puis lecture coach uniquement dans une identité athlète autorisée et sur une donnée de test clairement isolée. La consultation admin seule ne valide pas ce parcours.
- **Rendu/accessibilité** : 320/360/390/430/768/1280 px, clair/sombre, texte agrandi, focus, noms accessibles, contrastes AA, réduction des animations, aucun débordement ni action sous la navigation.
- Tests de dates et règles dérivées dans le projet ; contrôles visuels et parcours documentés sans données fictives dans l’application réelle.
- Rapport final : problèmes, fichiers modifiés, changements, tests exécutés, limites et risques. Téléphones physiques, lecteurs d’écran ou sauvegardes non exécutés seront explicitement indiqués, jamais déclarés validés.