# Pastilles des nouveaux wellness

- Ajouter une pastille rouge sur **Santé**, puis sur **Wellness**, avec le nombre de notifications non lues du membre du staff connecté.
- Retirer les pastilles lorsque ce membre du staff ouvre **Wellness** ; conserver les notifications des autres membres comme non lues.
- Appliquer ce fonctionnement à toutes les catégories et disciplines, sans réactiver les e-mails.
- Vérifier l’affichage et la disparition des pastilles avec les notifications réelles dans l’aperçu.

## Détails techniques
Réutiliser les notifications existantes `wellness_submitted`, qui excluent déjà le remplissage automatique et les saisies du staff. Ajouter un compteur dédié et invalider les compteurs et la cloche après lecture, comme pour le RPE. Aucun changement aux calculs wellness ni à leur saisie.