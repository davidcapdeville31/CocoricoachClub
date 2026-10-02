# Pastille des nouveaux RPE athlètes

## Résultat attendu
- Afficher une pastille dans **Performance** lorsqu’un athlète renseigne son RPE de séance, pour toutes les catégories et disciplines.
- Reporter cette pastille sur **Charge d’entraînement**, afin d’identifier immédiatement l’endroit concerné.
- Dans la notification, afficher clairement **RPE saisi / objectif RPE prévu** avec le nom de l’athlète et la date de séance.
- Un clic ouvre directement la comparaison RPE prévu/réel de la séance concernée et marque la notification comme lue.

## Mise en œuvre
- Enrichir la notification déjà créée lors d’un retour de séance avec l’intensité planifiée de la séance.
- Ne notifier que les saisies réelles faites par l’athlète : exclure les remplissages automatiques et les modifications du staff.
- Compter en temps réel les notifications RPE non lues de la catégorie dans les pastilles de navigation.
- Ajouter l’icône et la présentation adaptées dans le centre de notifications.
- Conserver le fonctionnement actuel des notifications push, sans réactiver les e-mails.

## Vérification
- Contrôler la compilation et les erreurs de l’application.
- Vérifier le parcours staff : pastille visible, notification avec les deux RPE, ouverture du bon écran et disparition après lecture.
