# Commandes par table — Chez Papa

Le menu, le livre et l’ancien registre local restent en place. Les nouvelles commandes passent par le serveur : les prix viennent du catalogue du site, et le QR code d’une commande ne contient qu’un jeton opaque.

## Parcours client

1. Imprimer un QR code par table depuis `/impression/tables`, sur le site public.
2. Le client scanne le QR de sa table, par exemple `/t/4`. La table est reconnue, il ne la choisit pas.
3. Il compose son panier dans la carte, puis ouvre « Valider la commande ».
4. Le serveur enregistre la commande au statut `submitted` et affiche le récapitulatif.
5. « J’ai terminé ma commande » passe la commande à `ready_for_pickup` et affiche son QR code.
6. Ce QR reste visible après un rafraîchissement, via « Retrouver ma commande », tant que la commande n’est pas récupérée, clôturée ou annulée.

Un panier vide n’est pas envoyé. Si l’enregistrement échoue, le panier n’est pas vidé.

## Parcours restaurant

1. Ouvrir `/salle` et entrer le code salle.
2. Les tables se mettent à jour toutes les deux secondes, sans rechargement manuel.
3. Une table passe au rouge dès qu’au moins une commande est « À récupérer ». Le libellé texte reste affiché à côté de la couleur.
4. Aller à la table, ouvrir Scanner, lire le QR du client, vérifier le détail, puis « Confirmer la récupération ».
5. Le serveur ne marque la commande récupérée qu’après confirmation. Un second scan du même QR est refusé.
6. « Récupérée » n’est ni « servie » ni « payée ». Clôturer et encaisser sont deux actions séparées.
7. Clôturer la session libère la table pour le groupe suivant. Une session qui a encore une commande envoyée ou à récupérer ne peut pas être fermée.

Le nombre de tables se règle en bas du tableau. La valeur de départ est 10.

## Statuts

`draft` reste le panier sur le téléphone, avant l’envoi. Ensuite : `submitted`, `ready_for_pickup`, `claimed`, `completed`, `cancelled`.

## Sécurité

- Le tableau, le scanner et l’historique exigent un jeton de personnel.
- Un client ne reçoit que les commandes de son appareil.
- Le QR de commande ne contient ni nom, ni articles, ni prix. Le serveur retrouve la commande par l’empreinte du jeton.
- Le jeton est retiré de l’usage après récupération, annulation ou expiration (36 heures).
- Les prix ignorent toute valeur envoyée par le navigateur.
- Avec Supabase, les tables ont le RLS forcé et aucun droit pour les rôles `anon` et `authenticated`. La clé secrète reste dans les variables serveur.
- Le tableau n’utilise pas un canal public temps réel : cela diffuserait l’état des tables à tous les visiteurs. Les mises à jour passent par l’API authentifiée.

Les notifications du navigateur et le son ne partent que si le personnel les active, et une seule fois par commande. Elles ne fonctionnent pas quand l’application est fermée : les notifications push fermées ne sont pas branchées.

## Variables d’environnement

À conserver, elles servent déjà au site :

- `VITE_PUBLIC_MENU_URL`
- `VITE_RESTAURANT_ADDRESS`, `VITE_RESTAURANT_PHONE`, `VITE_RESTAURANT_HOURS`
- `VITE_RESTAURANT_MAPS_URL`, `VITE_RESTAURANT_REVIEWS_URL`
- `VITE_RESTAURANT_INSTAGRAM`, `VITE_RESTAURANT_FACEBOOK`
- `VITE_SALLE_CODE` : uniquement l’ancien registre de l’appareil (`/salle/appareil`)

Nouvelles variables. Ne jamais préfixer les secrets par `VITE_`.

| Variable | Où | Rôle |
| --- | --- | --- |
| `VITE_API_BASE` | application Android | adresse du site, par exemple `https://chezpapa-beta.vercel.app` |
| `SUPABASE_URL` | serveur | projet Supabase Chez Papa |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur | clé secrète, jamais dans l’APK |
| `ORDER_TOKEN_KEY` | serveur | clé qui permet de réafficher le QR du client |
| `STAFF_PASSWORD` | serveur | code salle du restaurant. Le recopier depuis le code déjà utilisé, sans le mettre dans le code source |

Sans `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `ORDER_TOKEN_KEY`, le site publié répond que le serveur est indisponible. En développement local, les commandes restent en mémoire le temps du serveur.

Créer le projet Supabase « Chez Papa » dans l’organisation existante coûte 0 € par mois. La création attend une confirmation explicite, puis la migration `supabase/migrations/20261028120000_commandes_salle.sql` doit être appliquée. Ne pas réutiliser un autre projet (Aladdin, HORECA, etc.).

## Application Android

L’application est une coque Capacitor autour du même site. Elle n’a pas de seconde base. Elle s’installe par APK, sans Play Store.

```powershell
npm install
npm run build
npx cap add android
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

L’APK de test se trouve alors dans `android\app\build\outputs\apk\debug\app-debug.apk`. Il est signé avec le certificat de débogage d’Android Studio, pas avec un certificat de production. Ce fichier n’est pas versionné : le dossier `android/app/build` est ignoré par Git.

Construction locale du 28 octobre 2026 : `app-debug.apk`, 6 113 406 octets, empreinte SHA-256 `9899a1bbf344362d6c898183223fac66f18b4aed4f432e1fbc90d0b7a33ca152`. Une reconstruction change cette empreinte. Aucun téléphone physique n’a été utilisé pour l’installation.

Java 21 et le SDK Android (`ANDROID_HOME`) sont nécessaires. Sans `ANDROID_HOME`, le SDK installé par Android Studio est souvent dans `%LOCALAPPDATA%\Android\Sdk`. Si `JAVA_HOME` pointe encore vers un ancien dossier JDK supprimé, la construction échoue : le définir pour la session sur le JDK réellement installé, par exemple `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`.

Transfert : copier le fichier sur le téléphone, ou `adb install -r app-debug.apk`. Autoriser l’installation depuis cette source. À l’ouverture, l’application demande le code salle, puis la caméra.

Mise à jour : incrémenter `versionCode` dans `android/app/build.gradle`, reconstruire, réinstaller par-dessus. Garder le même certificat de signature, sinon Android refuse la mise à jour.

Signature de production :

```powershell
keytool -genkeypair -v -keystore chezpapa-salle.keystore -alias salle -keyalg RSA -keysize 2048 -validity 10000
```

Le keystore ne doit pas être commité. Renseigner `android/keystore.properties` (fichier ignoré) :

```properties
storeFile=../../chezpapa-salle.keystore
storePassword=...
keyAlias=salle
keyPassword=...
```

Puis `.\gradlew.bat assembleRelease`. Vérifier le fichier reçu avec :

```powershell
certutil -hashfile app-release.apk SHA256
```

Comparer l’empreinte avec celle annoncée au moment de la construction.

`VITE_API_BASE` doit être défini au moment de `npm run build` si l’APK ne doit pas deviner l’adresse. Sans cette variable, l’application native appelle `https://chezpapa-beta.vercel.app`.

Aucune notification push n’est livrée quand l’application est fermée. Le son et les notifications locales fonctionnent seulement pendant que le tableau est ouvert et que le téléphone les autorise.
