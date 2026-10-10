# Feuille de score bowling : saisie mobile guidée

## Résultat attendu
Sur téléphone, saisir une partie complète avec un pavé tactile, une frame active et une navigation à une main, sans zoom ni défilement horizontal. Sur ordinateur, conserver la feuille traditionnelle à dix frames. Les deux vues utilisent les mêmes données.

## 1. Fiabilité et protection des données
- Vérifier les calculs existants avant de brancher la nouvelle vue ; conserver les règles officielles et corriger seulement les écarts démontrés par les tests.
- Distinguer lancer absent et gouttière saisie ; afficher le score cumulé confirmé et « Bonus en attente » lorsque nécessaire.
- Respecter les trois cas de la dixième frame, y compris la remise en place des quilles et les limites des lancers bonus.
- En correction, conserver toutes les frames suivantes et recalculer leurs scores. Demander confirmation uniquement pour retirer des lancers devenus incompatibles dans la frame corrigée.

## 2. Interface mobile
- En-tête compact : numéro de partie, frame active / 10, dix repères de progression, frames terminées et dernière frame jouée.
- Pavé numérique large 0–10, Strike X clairement nommé ; spare automatique selon les quilles restantes. Un toucher enregistre le lancer, sans validation supplémentaire après un strike.
- Passage automatique au lancer ou à la frame suivante, avec accès direct aux frames précédentes et commandes précédente/suivante.
- Détails facultatifs repliables par lancer : poches, splits et autres champs existants. Leur absence n’est pas comptée comme un échec.
- « Voir ma feuille de score » : dix cartes repliables affichant lancers et cumuls déterminables, touchables pour corriger.
- Identité bowling actuelle : actions bleu nuit, fond bleu pâle, surfaces claires, orange et vert ; réutiliser les illustrations existantes si elles restent discrètes. Animations brèves et accessibles.

## 3. Plusieurs parties, modes et enregistrement
- Résumé de partie terminée, ajout d’une partie, consultation et correction des précédentes.
- Moyenne, meilleure partie et total calculés seulement sur les parties terminées ; les parties incomplètes restent identifiables et sauvegardables.
- Garder saisie rapide et détaillée distinctes. Un score rapide reste conservé tant qu’il n’est pas remplacé volontairement : aucun lancer inventé et aucune suppression silencieuse au changement de mode.
- Vérifier la conservation des lancers à l’enregistrement d’une séance et à sa réouverture, sans migration inutile ni modification des droits.

## 4. Vérifications avant conclusion
- Tests de règles : partie parfaite 300 ; dix frames 9–0 = 90 ; spares 5–5 avec bonus 5 = 150 ; strike suivi de deux lancers ; spare suivi d’un strike ; dixième strike et spare ; correction antérieure ; plusieurs parties ; sauvegarde/réouverture incomplète.
- Vérifications visuelles du parcours complet à 320, 360, 390 et 430 px, puis sur ordinateur ; boutons accessibles, aucun débordement, détails repliables et corrections utilisables.
- Vérifier statistiques et dénominateurs après saisie, sans assimiler absence à zéro ou échec.
- Tester la sauvegarde réelle et la lecture après réouverture sur un compte autorisé si accessible. Sinon, distinguer clairement les tests simulés des vérifications connectées restantes.

## Détails techniques
- Ajouter une vue mobile ciblée à la feuille partagée existante ; ne pas reconstruire la fenêtre de séance ni modifier les autres sports.
- Partager état des frames, validation et calcul entre vue guidée et tableau ordinateur ; conserver la compatibilité des historiques.
- Couvrir les règles par de petits tests conservés dans le projet et vérifier les points d’intégration du bloc Parties.
- Les statistiques facultatives pourront nécessiter un marquage rétrocompatible des observations renseignées dans les données de lancer existantes ; ne pas réinterpréter les anciens historiques.

## Point relevé pendant l’audit
La feuille actuelle réduit son tableau sur mobile au lieu de changer de parcours. Certains calculs traitent également des bonus incomplets comme déterminés et certains dénominateurs supposent des lancers non renseignés : ces cas seront isolés par des tests avant correction.