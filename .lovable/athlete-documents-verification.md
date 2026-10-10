# Documents athlète — vérifications

## Périmètre livré
Sélecteur deux colonnes, hauteur tactile 44 px, badges de compte ; fonds opaques. Actif marine en clair et bleu contrasté en sombre, exception locale par tokens sans modifier les autres sélections. Ajout contextuel selon `is_player_owner`/`can_manage_category_documents` existants ; aucune permission créée. État vide avec action autorisée, chargement distinct d'une absence et erreur avec Réessayer. Cartes avec titre complet (même sans espaces), type, origine, date disponible, notes, expiration, auteur et commandes nommées accessibles. Consulter/télécharger et édition/suppression existantes conservées ; aucun partage fictif. Traductions FR/EN.

## Exécuté
- `bun test src/lib/athleteDocumentAccess.test.ts` : 4 tests, 6 assertions, succès.
- Compte staff connecté, consultation de Manon CLEMENT : zéro document personnel et un document d'équipe réel. Ouverture du formulaire sans envoi.
- Deux onglets × deux thèmes × 320/360/390/430/768/1280 px : 24 états, aucune largeur dépassée ; onglets ≤48 px.
- Réponses réseau simulées, pas de données de démonstration dans l'application : 0/1/4 documents × 2 thèmes × 2 onglets, noms longs, date absente. Propriétaire sans gestion collective : aucun ajout collectif, option collective absente du formulaire. Chargement retardé, erreur 500, Réessayer puis retour des cartes.
- Aucune erreur JavaScript dans ces parcours. Signal compilation : OK.

## Limites
Capture annoncée non identifiable parmi les pièces jointes de ce tour : audit effectué sur l'écran réel. Aucune écriture, suppression ni modification de document stocké. Pas de dépôt authentifié en identité athlète, pas de téléchargement réel ni de téléphone physique. Les restrictions sont testées unitairement et avec réponses simulées ; les politiques serveur ne sont pas modifiées. Audit global des autres écrans toujours ouvert séparément.