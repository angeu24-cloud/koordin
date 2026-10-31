# KOORDIN — Guide d'installation pas à pas

Ce guide permet de mettre KOORDIN en ligne **sans être informaticien**.
Comptez environ **30 minutes**. Tout est gratuit pour démarrer.

Vous aurez besoin de :
- un ordinateur avec un navigateur (Chrome conseillé) ;
- une adresse email ;
- le dossier `koordin` (celui qui contient ce guide), décompressé sur votre ordinateur.

---

## Étape 1 — Créer la base de données (Supabase)

1. Allez sur **https://supabase.com** → **Start your project** → créez un compte (avec votre email ou GitHub).
2. Cliquez **New project** :
   - **Name** : `koordin`
   - **Database Password** : cliquez *Generate a password* et **notez-le** dans un endroit sûr.
   - **Region** : choisissez la plus proche de vos équipes (pour l'Afrique de l'Ouest : *West EU (Ireland)* ou *Central EU (Frankfurt)*).
   - Cliquez **Create new project** et attendez 1 à 2 minutes.

## Étape 2 — Installer le schéma KOORDIN

1. Dans le menu de gauche de Supabase, ouvrez **SQL Editor**.
2. Cliquez **New query**.
3. Ouvrez le fichier `supabase/schema.sql` avec le Bloc-notes (clic droit → Ouvrir avec → Bloc-notes), **sélectionnez tout** (Ctrl+A), **copiez** (Ctrl+C).
4. **Collez** dans l'éditeur Supabase (Ctrl+V), puis cliquez **Run** (en bas à droite).
5. Vous devez voir *Success. No rows returned*.

Le schéma crée toutes les tables, les règles d'habilitation par rôle, les alertes automatiques
(budget, stock, double facturation) et l'espace de stockage des photos de chantier.

> ⚠️ Ne lancez ce script qu'**une seule fois**. Si vous le relancez, il affichera des erreurs « already exists » : c'est sans danger, mais inutile.

## Étape 3 — Régler la connexion des utilisateurs

Dans Supabase → **Authentication** :

1. **URL Configuration** → **Site URL** : vous y mettrez l'adresse de votre site à l'étape 5 (revenez ici après).
2. **Sign In / Providers** → **Email** :
   - **Confirm email** est activé par défaut : chaque nouvel utilisateur doit cliquer sur un lien reçu par email.
   - ⚠️ Le service d'email gratuit de Supabase n'envoie que **quelques emails par heure**. Deux solutions :
     - **Pour démarrer rapidement** (pilote avec votre équipe) : désactivez **Confirm email**. Créez alors les invitations juste avant que chaque personne s'inscrive.
     - **Pour une utilisation durable** : gardez la confirmation et branchez un service d'email gratuit (par exemple Brevo) dans **Authentication → Emails → SMTP Settings**.

## Étape 4 — Relier l'application à votre base

1. Dans Supabase → **Project Settings** (roue dentée) → **API** (ou **Data API**), repérez :
   - **Project URL** (ex. `https://abcdxyz.supabase.co`)
   - la clé **anon public** (une longue suite de caractères commençant par `eyJ…`, ou `sb_publishable_…`)
2. Ouvrez le fichier `app/config.js` avec le Bloc-notes et remplacez les deux valeurs :

```js
window.KOORDIN_CONFIG = {
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi....",
};
```

3. Enregistrez le fichier.

> La clé « anon public » est faite pour être visible : la sécurité est assurée par les règles de la base de données installées à l'étape 2.
> **Ne mettez jamais** la clé « service_role » ni la clé Anthropic dans ce fichier.

## Étape 5 — Mettre l'application en ligne (Netlify, gratuit)

1. Allez sur **https://app.netlify.com/drop** et créez un compte.
2. **Glissez-déposez le dossier `app`** (le dossier entier) dans la zone indiquée.
3. Après quelques secondes, Netlify vous donne une adresse du type `https://nom-au-hasard.netlify.app`.
   - Vous pouvez la renommer : **Site configuration → Change site name** (ex. `koordin-btpivoire.netlify.app`).
4. Retournez dans Supabase → **Authentication → URL Configuration** :
   - **Site URL** : collez votre adresse Netlify ;
   - **Redirect URLs** : ajoutez la même adresse.

Pour publier une nouvelle version plus tard : Netlify → votre site → **Deploys** → glissez-déposez à nouveau le dossier `app`.

## Étape 6 — Activer l'assistant IA (facultatif)

L'assistant IA analyse vos vraies données de chantier. Il nécessite une clé Anthropic (payante à l'usage).

1. Créez une clé sur **https://console.anthropic.com** → **API Keys** → **Create Key**. Copiez-la (elle commence par `sk-ant-`).
2. Dans Supabase → **Edge Functions** → **Secrets** → ajoutez :
   - Name : `ANTHROPIC_API_KEY`
   - Value : votre clé
3. Dans Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor** :
   - Nom de la fonction : `koordin-ia` (exactement)
   - Remplacez tout le code proposé par le contenu du fichier `supabase/functions/koordin-ia/index.ts`
   - Cliquez **Deploy function**.

L'assistant est disponible pour la Direction, la Coordination, les Achats, la Comptabilité et le Magasin.
Il ne voit que les données que la personne connectée a le droit de voir.

> 💡 **Coût** : chaque question envoie un résumé de vos chantiers à l'IA. Surveillez votre consommation dans la console Anthropic (**Usage**) et fixez une limite mensuelle (**Limits**).
> Le modèle utilisé est indiqué en haut du fichier `index.ts` (ligne `const MODEL = …`).

## Étape 7 — Premier lancement

1. Ouvrez votre adresse Netlify.
2. Onglet **Créer mon entreprise** : nom de l'entreprise, votre nom, email, mot de passe.
   Vous devenez automatiquement **Direction** (administrateur).
3. Pour découvrir l'outil : **Paramètres → Charger la démonstration** (3 chantiers d'exemple).
   Vous pourrez supprimer ces projets ensuite (Projet → Supprimer).
4. Créez vos vrais projets : **Projets → Nouveau projet**.

## Étape 8 — Inviter votre équipe

1. **Équipe → Inviter une personne** : nom, email, rôle.
2. KOORDIN prépare un message prêt à envoyer par **WhatsApp**, email, ou à copier.
3. La personne ouvre le lien, choisit **J'ai une invitation** et crée son mot de passe **avec la même adresse email**.
4. Pour les **techniciens** : affectez-les à leurs chantiers (**Projet → Équipe → Affecter une personne**).
   Un technicien ne voit que les chantiers auxquels il est affecté.

### Installer KOORDIN sur le téléphone des équipes
- **Android (Chrome)** : ouvrir l'adresse → menu ⋮ → **Ajouter à l'écran d'accueil**.
- **iPhone (Safari)** : ouvrir l'adresse → bouton **Partager** → **Sur l'écran d'accueil**.

---

## Qui voit quoi ?

| Rôle | Ce qu'il fait dans KOORDIN |
|---|---|
| 👔 **Direction** | Vue globale de tous les projets (avancement réel/prévu, budget, retards, graphiques), alertes, validation des rapports, gestion de l'équipe, assistant IA. |
| 🗂️ **Coordination** | Tous les projets, lots, planning (Gantt), affectation des équipes, réception et validation des rapports de terrain. |
| 🔧 **Technicien** | Ses chantiers uniquement. Rapport journalier depuis le téléphone (travaux, effectif, météo, incidents, besoins, photos). Ne voit aucun montant. |
| 🛒 **Achats** | Commandes par projet et par lot, fournisseurs. Voit immédiatement le budget restant et reçoit une alerte en cas de dépassement. |
| 📊 **Comptabilité** | Factures et dépenses, paiements, échéances, budget/réalisé par projet, détection de doubles factures, export Excel. |
| 📦 **Magasin** | Stock, entrées/sorties par chantier, seuils d'alerte, réception des commandes. |

## Automatismes intégrés

- Un rapport validé met à jour l'**avancement du lot**, donc celui du projet.
- Chaque commande ou facture recalcule le **budget consommé** ; alerte à 90 % et en cas de dépassement (projet et lot).
- Une facture d'un même fournisseur, du même montant, à moins de 60 jours d'une autre déclenche une alerte **double facturation**. Un numéro de facture déjà saisi pour un fournisseur est refusé.
- Une sortie de stock supérieure à la quantité disponible est refusée ; passer sous le seuil déclenche une alerte **stock bas**.
- Le flux d'activité (🔔) se met à jour **en temps réel**.

## Mettre à jour une installation existante (version 1.5)

La version 1.5 ajoute la **photo de couverture des chantiers**, les **communiqués** (messages de la Direction à l'équipe) et les **annonces sponsorisées** (gérées depuis la console KOORDIN). Si KOORDIN est déjà installé :

1. Supabase → **SQL Editor** → **New query**.
2. Ouvrez le fichier `supabase/mise-a-jour-1.5.sql` avec le Bloc-notes, copiez tout, collez dans l'éditeur, puis **Run**.
3. Vous devez voir *Success. No rows returned*. Ce script peut être relancé sans risque.

Tant que ce script n'a pas été exécuté, l'application affiche « Cette fonction nécessite la mise à jour 1.5 de la base de données » quand on essaie d'ajouter une photo de chantier ou un communiqué.

## En cas de problème

| Symptôme | Solution |
|---|---|
| « L'application n'est pas encore reliée à votre base de données » | Vérifiez `app/config.js` (étape 4), puis redéposez le dossier `app` sur Netlify. |
| « Email ou mot de passe incorrect » après inscription | Confirmez l'email (lien reçu), ou désactivez *Confirm email* (étape 3). |
| « Votre compte n'est rattaché à aucune entreprise » | L'invitation n'existe pas pour cet email exact. La Direction doit la créer dans **Équipe**. |
| Le lien de confirmation ouvre une page d'erreur | Vérifiez *Site URL* et *Redirect URLs* (étape 5). |
| « Cette fonction nécessite la mise à jour 1.5 de la base de données » | Exécutez `supabase/mise-a-jour-1.5.sql` dans Supabase → SQL Editor (voir ci-dessus). |
| « L'assistant IA n'est pas joignable » | La fonction `koordin-ia` n'est pas déployée ou mal nommée (étape 6). |
| « Clé ANTHROPIC_API_KEY absente ou invalide » | Vérifiez le secret dans Supabase → Edge Functions → Secrets. |
