# ⬡ KOORDIN — Plateforme de pilotage de chantiers BTP

Centralise tous les projets d'une entreprise du BTP sur une seule plateforme, avec un espace par métier :
Direction, Coordination, Techniciens, Achats, Comptabilité, Magasin.

- **Installer et mettre en ligne** : voir [GUIDE-INSTALLATION.md](GUIDE-INSTALLATION.md) (30 minutes, sans compétence technique).
- **Propriétaire du projet** : Ange Uriel N'DEDE AYEMOU — BTP / coordination de projets, Côte d'Ivoire.

## Contenu du dossier

```
koordin/
├── GUIDE-INSTALLATION.md          Guide pas à pas (Supabase + Netlify + IA)
├── README.md                      Ce fichier (vue d'ensemble + notes techniques)
├── docs/                          L’application web (publiée par GitHub Pages)
│   ├── index.html                 Page d'entrée
│   ├── config.js                  Adresse et clé publique Supabase
│   ├── app.js                     Tous les écrans et la logique par rôle
│   ├── styles.css                 Thèmes sombre et clair, mobile et ordinateur
│   ├── sw.js, manifest.webmanifest, icon.svg   Installation sur téléphone (PWA)
│   └── vendor/                    Bibliothèques intégrées (Supabase, Chart.js)
└── supabase/
    ├── schema.sql                 Base de données, habilitations, alertes, démo
    ├── functions/koordin-ia/      Assistant IA (fonction serveur)
    └── config.toml                Configuration pour la ligne de commande Supabase (facultatif)
```

## Fonctionnalités

| Module | Détail |
|---|---|
| Tableau de bord Direction | Projets actifs/critiques, avancement réel vs prévu, budget consommé, rapports à valider, graphiques, flux d'activité |
| Projets | Fiche, lots avec budget/engagé/facturé, planning Gantt, équipe affectée, achats et factures du projet |
| Rapports terrain | Formulaire mobile (photos compressées, brouillon automatique), validation/rejet avec commentaire, mise à jour de l'avancement |
| Achats | Commandes par lot avec contrôle du reste disponible, budget par lot, fournisseurs, réception |
| Comptabilité | Factures/dépenses par catégorie, échéances, paiements, budget/réalisé, export CSV (Excel) |
| Stock | Articles, seuils, entrées/sorties par chantier, historique, valeur du stock |
| Équipe | Invitations par rôle (WhatsApp/email), changement de rôle, désactivation |
| Assistant IA | Questions en langage naturel sur les données réelles, limitées aux habilitations de l'utilisateur |
| Alertes | Dépassement de budget (projet et lot), stock bas, double facturation, incident signalé — en temps réel |

## Notes techniques (pour un développeur)

**Architecture** : application monopage en JavaScript sans étape de compilation (`app/`), hébergeable sur n'importe quel
hébergement statique. Toutes les données sont dans Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions).

**Sécurité** : toute l'autorisation est dans la base (Row Level Security, `supabase/schema.sql`) :
- `mon_entreprise()`, `mon_role()`, `a_role(...)`, `voit_projet(id)` sont les fonctions d'habilitation ;
- isolation stricte entre entreprises (multi-entreprise / SaaS) ;
- les vues `v_projets`, `v_budget_lots`, `v_stock` sont en `security_invoker` : un technicien n'y voit pas les montants ;
- les photos sont rangées `photos-chantier/<entreprise_id>/<rapport_id>/…` avec des règles Storage par entreprise ;
- les actions sensibles passent par des fonctions contrôlées (`receptionner_commande`, `charger_demo`, `accepter_invitation`).

**Comptes** : un déclencheur sur `auth.users` crée le profil. Inscription avec `entreprise` dans les métadonnées → nouvelle
entreprise + rôle `direction` ; inscription avec un email invité → rattachement avec le rôle de l'invitation.

**IA** : `supabase/functions/koordin-ia/index.ts` interroge Claude côté serveur (`ANTHROPIC_API_KEY` en secret Supabase).
Le contexte est lu avec le jeton de l'utilisateur, donc filtré par les mêmes règles de sécurité. Rôles autorisés :
constante `ROLES_AUTORISES` (à garder alignée avec `ROLES_IA` dans `app.js`).

**Ce qui a été testé** (Supabase local + navigateur automatisé) :
- 51 vérifications d'habilitation (chaque rôle, isolation entre entreprises, accès anonyme, photos) ;
- parcours complet : création d'entreprise, démo, invitations des 6 rôles, affectation, rapport mobile avec photo,
  validation, commande avec alerte de dépassement, facture en doublon, export CSV, refus de sortie de stock excessive,
  notifications, thème clair/sombre, absence de débordement sur mobile ;
- la fonction IA exécutée avec un faux serveur Claude : requête, contexte filtré par rôle, refus du rôle technicien.
  L'appel réel à l'API Anthropic n'a pas pu être testé (pas de clé dans l'environnement de développement).

**Pistes d'évolution** : mode hors ligne complet pour les rapports (file d'attente), export PDF des rapports, notifications
push / SMS, paiement des licences (Flutterwave / Mobile Money), multilingue, application mobile native.
