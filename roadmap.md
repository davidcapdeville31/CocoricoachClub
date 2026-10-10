# Calendrier de charge

## Rétablir la présence depuis l’accueil
- [x] Réutiliser Présent / Absent sur les cartes à remplir, absentes et à venir ; mêmes sauvegardes et restrictions, séances personnelles exclues.
- [ ] Vérifier affichage et interactions clair/sombre sans modifier de réponse réelle.

## Espace Documents athlète
- [x] Compacter onglets, compteurs, cartes et état vide ; ajout contextuel par droits existants, données inchangées.
- [x] 4 tests de droits ; 24 états réels et 12 états simulés (zéro/un/plusieurs, noms longs, chargement/erreur/retry), 320–1280 px ; aucune écriture. Rapport `.lovable/athlete-documents-verification.md`.

## Refonte ciblée du calendrier athlète
- [x] Auditer les composants, dépendances et données ; observer le calendrier réel connecté de Manon à 390 px et analyser les deux références.
- [x] Plan approuvé avant les changements structurants.
- [x] Donner priorité à la grille, expliciter Calendrier / Planification et ajouter Mois / Semaine / Aujourd’hui sans changer les données.
- [x] Compacter événements, Wellness, cycles et confirmations ; conserver les actions réduites et les formulaires existants.
- [x] Afficher présences, motifs, chargements et erreurs sans changer les règles métier.
- [x] Vérifier navigation et six tests de dates ; bowling clair/sombre aux six largeurs, rugby/judo/athlétisme à quatre largeurs, erreur réseau puis récupération et dernière action dégagée.
- [x] Rapport précis dans `.lovable/athlete-calendar-verification.md` ; audit global des contrastes maintenu séparément.
- [ ] Enregistrement présence/séance et lecture coach : nécessite une identité athlète autorisée et des données de test ; aucune réponse réelle modifiée avec le compte staff disponible.

## Actions des séances réduites
- [x] Garder Voir la séance / Remplir les données visibles côte à côte sans déplier la carte ; restrictions existantes conservées.
- [x] Présent vert / Absent rouge hors sélection générique, séances et compétitions : rendu vérifié aux six largeurs 320/360/390/430/768/1280 en clair/sombre, sans débordement. Séance réelle en consultation : les deux fenêtres s’ouvrent depuis la carte fermée. Couleurs testées par simulation des états DOM sans écrire de réponse ; sauvegarde de présence non retestée, téléphone physique non testé. Build OK.

## Ressenti après séance
- [x] Raccorder les cinq choix de forme aux couleurs fonctionnelles communes, hors sélection générique, sans changer les valeurs ni la sauvegarde.
- [x] Vérifier les dix états du composant réel isolé en clair/sombre dans un cadre 320 px : couleurs identiques, focus stable, libellés et coche lisibles ; contrastes 4,97–10,08:1, aucune erreur JS. Compte connecté consulté mais sans séance accessible : formulaire complet et sauvegarde non retestés.

## Audit global thèmes clair/sombre
- Première étape documentée dans `.lovable/theme-audit-report.md` : 84 états connectés, 7 écrans, clair/sombre et six largeurs ; aucun contraste/label/bouton sans nom détecté au dernier passage, zéro débordement et erreur JS ; 28 tests réussis. Audit exhaustif, modales, autres disciplines, états interactifs et anomalies de structure encore à traiter.
- [ ] Inventorier routes, styles fixes, composants partagés, RPE et graphiques.
- [x] Zone principale accessible ajoutée aux pages Clubs, Paramètres, Admin, Super Admin, catégorie, club et athlète.
- [x] Titres de cartes hiérarchisés, tableau Admin lisible sur mobile (défilement interne), préférences de notifications empilées sur petit écran.
- [ ] Fiabiliser tokens et contrastes, formulaires, sélections imbriquées et portails sans changement métier.
- [ ] Déployer l’échelle RPE chromatique commune, préserver les observations bowling et Wellness.
- [ ] Contrôler les interfaces accessibles en clair/sombre, plusieurs largeurs et états ; produire un rapport avec couverture et limites explicites.

## Identité officielle bleu blanc rouge
- [x] Logo sombre : damier intégré remplacé par le même logo que le thème clair, traits blancs et rouge conservé ; chargement CDN et rendu connexion vérifiés, correction partagée par les en-têtes.
- [x] Harmoniser onglets partagés, navigation, commandes, groupes et filtres exercices/tests en bleu marine opaque et blanc ; rouge notifications, Wellness vert conservé.
- [x] Vérifier en consultation connectée les onglets Admin/Planning/Programmation/Santé et l’espace Manon : sélections #10264A, texte/icônes blancs, graisse 600 ; clair/sombre à 320/360/390/430/768/1280 px sans débordement, menu Plus et thème testés ; aucun enregistrement ni push. Contrôle non exhaustif de chaque formulaire spécifique.

## Feuille de score bowling mobile
- [x] Unifier Poche/Split : couleurs fixes #169B70/#C93E4C, cycle null/oui/non, réinitialisation ciblée ; 23 tests réussis et neuf combinaisons contrôlées en clair/sombre à 320 px, hover/focus/pression, cycles tactiles et retour de frame dans le composant isolé avec Android Chromium simulé. Téléphone physique et sauvegarde connectée non testés.
- [x] Intégrer Poche/Split sous le pavé, trois états et progression volontaire, sans modifier scores ni historiques.
- [x] Vérifier observations, corrections, dixième frame et rendu clair/sombre à 320/360/390/430/768/1280 px : 17 tests réussis et parcours du composant réel isolé, reprise JSON et statistiques vérifiées ; aucun enregistrement connecté ni téléphone physique testé.
- [x] Examiner la feuille actuelle et les points de sauvegarde ; formaliser le plan.
- [x] Ajouter une saisie guidée mobile compatible avec la feuille ordinateur.
- [x] Préserver corrections, statistiques optionnelles, modes et parties incomplètes.
- [x] Vérifier les dix scénarios de calcul et le parcours à 320/360/390/430 px ; feuille ordinateur conservée.
- [ ] Vérifier sauvegarde/réouverture et statistiques sur compte connecté autorisé : simulation JSON validée, accès au compte demandeur indisponible.

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

## Finitions premium sans refonte
- [x] Compacter les séances (Musculation 153 → 107 px), harmoniser l’identité et supprimer les espacements cumulés ; Wellness vert inchangé.
- [x] Affiner navigation (73 → 65 px) et menu Plus, avec espace final mesuré incluant safe areas ; masquer la barre si le clavier réduit la zone de saisie.
- [x] Vérifier six séances réelles en consultation Alexis, dernière carte/action, consignes mentales, exercices dépliables, Infos et toutes destinations ; clair/sombre à 320/360/390/430/768/1280 px, menu à 320×568, Arthur et Manon ; aucun débordement ni erreur d’exécution. Aucun enregistrement ou push ; clavier/safe areas sur téléphone physique et séance mentale à titre exceptionnellement long non testés.

## Accueil premium fidèle à la maquette
- [x] Auditer navigation, thèmes, visibilité et composants réutilisables.
- [x] Ajouter navigation mobile fixe et panneau Plus, conserver les destinations et la navigation ordinateur.
- [x] Restaurer Wellness vert (à remplir et enregistré avec réponses dépliables), compacter l’identité et harmoniser les séances sans changer les données ; aucun indicateur hebdomadaire inventé.
- [x] Vérifier clair/sombre à 320/360/390/430/768/1280 px en consultation connectée Alexis : données Manon, Julie et Axelle ; Plus, thème, Planning, Stats, Chat, Performance, Infos, consignes mentales, réponses/édition Wellness et dernière carte dégagée. Aucun enregistrement ni push envoyé ; téléphone physique et sauvegarde en identité athlète non retestés.

## Identité visuelle premium athlète
- [x] Auditer les styles et le mécanisme de thème existants.
- [x] Harmoniser en-tête, navigation, wellness, séances et surfaces dans un périmètre athlète isolé.
- [x] Contrôler clair/sombre à 320/360/390/430/768/1280 px sur les espaces réels d’Axelle et Manon en consultation staff ; ouverture Wellness, séance mentale, bilan musculation, calendrier et Performance vérifiée sans enregistrer de données. Sauvegarde en identité athlète non testée (hors refonte visuelle).

## UX athlète mobile V2
- [x] Auditer contenu mental, cartes, circuits, bilans et statuts ; présenter le plan avant modification importante.
- [x] Donner priorité à une fiche mentale complète, lisible et liée aux réponses existantes.
- [x] Compacter les circuits, séparer consignes/résultats et clarifier la progression sans changer les calculs.
- [x] Identifier chaque bilan par sa séance et optimiser les cinq ressentis sur téléphone.
- [x] Séparer séances à réaliser et terminées selon les statuts réels.
- [x] Vérifier en simulation les écrans à 320/360/390/430/768/1280 px et les allers-retours ; six tests de circuits réussis.
- [ ] Vérifier l’enregistrement réel mental/circuit et la lecture coach : bloqué par l’absence de compte athlète authentifié autorisé dans ce fil.

- [x] Corriger les pictogrammes du menu et la lisibilité du résumé wellness, toutes disciplines.
- [x] Vérifier le menu et un wellness enregistré sur mobile en thèmes clair et sombre.
- [x] Décaler les boutons « Ajouter une séance » et « Récupération » sous le titre « Mon calendrier » sur mobile, sans chevauchement, toutes disciplines.
- [x] Vérifier l’en-tête du calendrier sur téléphone (393×665) et sur grand écran (boutons alignés à droite).
