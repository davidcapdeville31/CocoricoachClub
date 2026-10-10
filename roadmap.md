# Calendrier de charge

## Notification de composition
- [x] Préremplir un message de sélection modifiable et retirer les options et compteurs mail/SMS du dialogue partagé.
- [x] Vérifier le dialogue sur la composition Racing (23 comptes liés), sans envoyer de push de test aux athlètes ; Push décoché bloque l'envoi avec un message explicite.

## Notifications push d’Axelle
- [x] Corriger l’attente du démarrage réel du service avant d’enregistrer le téléphone.
- [x] Vérifier en simulation l’ordre démarrage → connexion → abonnement et l’absence de blocage après échec.
- [x] Confirmer la réception réelle sur le téléphone d’Axelle après nouvelle activation (confirmée par David).

## Vérification des notifications push toutes disciplines
- [x] Contrôler les abonnements des athlètes ayant activé tous les types de push : le service détecte 3 abonnements actifs sur 88 comptes, dont Axelle seule sur 46 Seniores.
- [x] Vérifier les rappels wellness/RPE sans envoyer de rappels supplémentaires : tâches planifiées actives ; RPE ciblé mais compteurs « envoyés » non probants ; wellness de 8h sans réponse après délai de 5 secondes.
- [x] Dans le rapport d’assiduité, déclarer Push/Mail actifs uniquement après confirmation d’un abonnement réellement activé ; afficher un état de vérification ou d’indisponibilité sinon.
- [ ] Confirmer la réception wellness/RPE sur les autres téléphones (nécessite leur activation effective et une confirmation des athlètes ; non vérifiable à distance).

## Aperçu des présences aux compétitions
- [x] Ajouter l’œil et les listes Présent / Absent / Sans réponse dans les vues du calendrier global, toutes disciplines.
- [x] Vérifier l’aperçu connecté avec les convocations réelles (Seniores, Blagnac et Racing Club de France), sur ordinateur et téléphone.

- [x] Afficher entraînements et compétitions, y compris amicales, dans la semaine et le mois pour toutes les disciplines.
- [x] Intégrer la référence compétition RPE 8 au résumé journalier sans modifier les charges réellement saisies.
- [x] Vérifier le calendrier avec une compétition réelle : amical contre Blagnac le 1er octobre et championnat contre L’Isle-Jourdain le 4 octobre, RPE 8 affiché.

# Affichage mobile de l’espace athlète

## UX athlète mobile V2
- [x] Auditer contenu mental, cartes, circuits, bilans et statuts ; présenter le plan avant modification importante.
- [ ] Donner priorité à une fiche mentale complète, lisible et liée aux réponses existantes.
- [ ] Compacter les circuits, séparer consignes/résultats et clarifier la progression sans changer les calculs.
- [ ] Identifier chaque bilan par sa séance et optimiser les cinq ressentis sur téléphone.
- [ ] Séparer séances à réaliser et terminées selon les statuts réels.
- [ ] Vérifier les écrans à 320/360/390/430 px et les allers-retours ; vérifier l’enregistrement authentifié si disponible.

- [x] Corriger les pictogrammes du menu et la lisibilité du résumé wellness, toutes disciplines.
- [x] Vérifier le menu et un wellness enregistré sur mobile en thèmes clair et sombre.
- [x] Décaler les boutons « Ajouter une séance » et « Récupération » sous le titre « Mon calendrier » sur mobile, sans chevauchement, toutes disciplines.
- [x] Vérifier l’en-tête du calendrier sur téléphone (393×665) et sur grand écran (boutons alignés à droite).
