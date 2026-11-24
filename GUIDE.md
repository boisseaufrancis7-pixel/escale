# Escale — guide de mise en ligne

Escale est une appli de voyage de groupe installable (une PWA) : tes amis l'ouvrent avec un lien, l'ajoutent à leur écran d'accueil, et elle fonctionne comme une appli. **Personne n'a besoin de créer un compte.** Les comptes de chaque groupe sont synchronisés en direct entre tous les membres, même hors ligne : les ajouts sont envoyés au retour du réseau.

**Temps prévu :** environ 20 minutes, sur un **ordinateur**.
**Coût :** 0 $. Le forfait gratuit de Firebase suffit largement pour des groupes d'amis, et aucune carte de crédit n'est demandée.

> **Pour l'essayer tout de suite :** **dézippe** d'abord le dossier, puis double-clique sur `index.html` sur ton ordinateur (ou mets le dossier en ligne tel quel). Sans configuration, l'appli fonctionne en **mode essai** : les comptes restent sur l'appareil, et le partage ne fonctionne pas encore.
>
> Sur un téléphone, ouvrir un fichier téléchargé marche mal : passe plutôt par la version en ligne (étape 4).

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html`, `app.js` | L'appli |
| `firebase-config.js` | **Le seul fichier à modifier** : les identifiants de ton projet Firebase |
| `firestore.rules` | Les règles de sécurité à coller dans Firebase |
| `manifest.webmanifest`, `sw.js`, `icons/` | Ce qui rend l'appli installable et utilisable hors ligne |

---

## Étape 1 — Créer le projet Firebase

1. Va sur **console.firebase.google.com** et connecte-toi avec ton compte Google.
2. Clique sur **Créer un projet** et nomme-le `escale`. Google Analytics n'est pas nécessaire : tu peux le désactiver.
3. Sur la page du projet, clique sur l'icône **Web `</>`** pour ajouter une appli Web. Nomme-la `Escale` et **ne coche pas** Firebase Hosting.
4. Firebase affiche un bloc `const firebaseConfig = { apiKey: "...", ... }`. **Copie les six valeurs** (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
5. Ouvre `firebase-config.js` avec un éditeur de texte et remplace chaque valeur par la tienne. Garde les guillemets.

## Étape 2 — Activer la connexion anonyme

C'est ce qui permet à tes amis d'utiliser l'appli sans créer de compte.

1. Dans le menu de gauche, va dans **Créer (Build) → Authentication** et clique sur **Commencer**.
2. Dans l'onglet **Mode de connexion (Sign-in method)**, choisis **Anonyme**, active-le, puis **Enregistre**.

## Étape 3 — Créer la base de données et la protéger

1. Va dans **Créer (Build) → Firestore Database** et clique sur **Créer une base de données**.
2. Emplacement : choisis **northamerica-northeast1 (Montréal)**, ou le plus proche de toi. On ne peut pas le changer après.
3. Choisis **Démarrer en mode production**, puis crée la base.
4. Ouvre l'onglet **Règles**, efface tout, colle le contenu du fichier `firestore.rules`, puis clique sur **Publier**.

Ces règles font trois choses :
- personne ne peut lister les groupes des autres;
- un groupe n'est accessible qu'avec son lien d'invitation, qui contient un identifiant secret de 34 caractères;
- les données reçues sont vérifiées (montants, longueurs).

## Étape 4 — Mettre l'appli en ligne (Netlify, gratuit)

1. Va sur **app.netlify.com** et connecte-toi.
2. Va dans **Add new project → Deploy manually**, puis glisse le **dossier complet** `escale-app`.
3. Dans **Project configuration → Change project name**, choisis par exemple `escale-ton-nom`. Ton appli est maintenant à `https://escale-ton-nom.netlify.app`.
4. De retour dans Firebase, va dans **Authentication → Paramètres (Settings) → Domaines autorisés** et ajoute `escale-ton-nom.netlify.app`.

Si tu modifies un fichier plus tard, glisse de nouveau le dossier dans **Deploys** sur Netlify.

## Étape 5 — Essayer

1. Ouvre ton adresse Netlify. La note « Mode essai » ne doit plus apparaître.
2. Crée un groupe et ajoute une dépense.
3. Appuie sur **Inviter** et ouvre le lien sur un autre téléphone. Choisis ton prénom (« Qui es-tu? »), ajoute une dépense, et regarde-la apparaître sur le premier téléphone en quelques secondes.

| Problème | Solution |
|---|---|
| La note « Mode essai » reste affichée | `firebase-config.js` n'est pas rempli, ou la nouvelle version n'a pas été republiée |
| « La connexion anonyme n'est pas activée » | Refais l'étape 2 |
| « Accès refusé par la base de données » | Les règles de l'étape 3 ne sont pas publiées |
| « Configuration Firebase invalide » | Une valeur a été mal copiée dans `firebase-config.js` |

## Installer l'appli sur un téléphone

- **iPhone (Safari) :** ouvre le lien, appuie sur **Partager**, puis sur **Sur l'écran d'accueil**.
- **Android (Chrome) :** ouvre le lien, appuie sur le menu **⋮**, puis sur **Installer l'application** (ou **Ajouter à l'écran d'accueil**).

L'icône Escale apparaît sur l'écran d'accueil, et l'appli s'ouvre en plein écran.

## Inviter des amis

Dans un voyage, appuie sur **Inviter** et envoie le lien dans votre conversation. Chaque personne qui l'ouvre choisit son prénom, puis voit et modifie les mêmes comptes.

⚠️ **Toute personne qui a le lien peut modifier le groupe.** Partage-le seulement avec le groupe concerné.

## Bon à savoir

- **Limites gratuites de Firebase :** des dizaines de milliers de lectures et d'écritures par jour. C'est énorme pour des groupes d'amis. Si l'appli devient populaire, Firebase t'avertira bien avant que ça coûte quelque chose.
- **Les identifiants dans `firebase-config.js` ne sont pas secrets.** C'est normal qu'ils soient visibles. Ce sont les règles de sécurité qui protègent les données.
- **Si tes amis changent de téléphone**, ils rouvrent simplement le lien d'invitation.

## Idées pour la suite

- Photo du reçu jointe à une dépense (avec Firebase Storage).
- Devises étrangères pour les voyages.
- Dépenses récurrentes (loyer, Internet).
- Notifications quand quelqu'un ajoute une dépense.
- Une vraie appli dans l'App Store et le Google Play, avec un outil comme Capacitor qui « emballe » ce code.

## La carte

La carte utilise **OpenStreetMap** (gratuit, sans clé). Quand tu ajoutes un lieu à une activité, Escale le place sur la carte automatiquement, avec un numéro et une couleur par jour. Si un lieu n'est pas trouvé, écris une adresse plus précise. Le bouton **Y aller** ouvre l'itinéraire dans Google Maps.
