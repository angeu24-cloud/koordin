-- ═══════════════════════════════════════════════════════════════════
--  KOORDIN — Schéma de base de données Supabase
--  À coller en une seule fois dans : Supabase > SQL Editor > New query > Run
--
--  Contenu :
--    1. Tables (entreprises, profils, projets, lots, planning, rapports,
--       achats, factures, stock, activités)
--    2. Fonctions d'habilitation (qui voit quoi)
--    3. Règles de sécurité (Row Level Security) par rôle
--    4. Automatismes (alertes budget, stock, double facturation, flux)
--    5. Vues de synthèse (avancement, budget, stock)
--    6. Stockage des photos de chantier
--    7. Données de démonstration (à charger depuis l'application)
--
--  Rôles : direction | coordinateur | technicien | achats | comptable | magasinier
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────────────────────────────
-- 1. TABLES
-- ───────────────────────────────────────────────────────────────────

create table public.entreprises (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  pays        text not null default 'Côte d''Ivoire',
  devise      text not null default 'FCFA',
  created_at  timestamptz not null default now()
);

create table public.profils (
  id            uuid primary key references auth.users(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  nom           text not null,
  email         text not null,
  telephone     text,
  role          text not null check (role in ('direction','coordinateur','technicien','achats','comptable','magasinier')),
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on public.profils (entreprise_id);

create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  email         text not null,
  nom           text,
  role          text not null check (role in ('direction','coordinateur','technicien','achats','comptable','magasinier')),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  acceptee_at   timestamptz
);
create index on public.invitations (lower(email));

-- ─── Fonctions d'habilitation ───
-- Elles lisent le profil de l'utilisateur connecté. "security definer" leur
-- permet de lire la table profils sans boucler sur ses propres règles.

create or replace function public.mon_entreprise() returns uuid
language sql stable security definer set search_path = public as $$
  select entreprise_id from profils where id = auth.uid() and actif
$$;

create or replace function public.mon_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profils where id = auth.uid() and actif
$$;

create or replace function public.a_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mon_role() = any(roles), false)
$$;

-- ─── Projets et structure ───

create table public.projets (
  id              uuid primary key default gen_random_uuid(),
  entreprise_id   uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  nom             text not null,
  reference       text,
  client          text,
  localisation    text,
  description     text,
  statut          text not null default 'en_cours' check (statut in ('preparation','en_cours','suspendu','termine')),
  budget          numeric(16,2) not null default 0 check (budget >= 0),
  date_debut      date,
  date_fin_prevue date,
  date_fin_reelle date,
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.projets (entreprise_id);

create table public.affectations (
  projet_id     uuid not null references public.projets(id) on delete cascade,
  profil_id     uuid not null references public.profils(id) on delete cascade,
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (projet_id, profil_id)
);
create index on public.affectations (profil_id);

-- Un technicien ne voit que les projets auxquels il est affecté ;
-- les autres rôles voient tous les projets de leur entreprise.
create or replace function public.voit_projet(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from projets pr
    where pr.id = p
      and pr.entreprise_id = public.mon_entreprise()
      and (public.mon_role() <> 'technicien'
           or exists (select 1 from affectations a where a.projet_id = p and a.profil_id = auth.uid()))
  )
$$;

create table public.lots (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id     uuid not null references public.projets(id) on delete cascade,
  nom           text not null,
  budget        numeric(16,2) not null default 0 check (budget >= 0),
  avancement    integer not null default 0 check (avancement between 0 and 100),
  ordre         integer not null default 0,
  created_at    timestamptz not null default now()
);
create index on public.lots (projet_id);

create table public.taches (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id      uuid not null references public.projets(id) on delete cascade,
  lot_id         uuid references public.lots(id) on delete set null,
  nom            text not null,
  date_debut     date not null,
  date_fin       date not null,
  avancement     integer not null default 0 check (avancement between 0 and 100),
  responsable_id uuid references public.profils(id) on delete set null,
  created_at     timestamptz not null default now(),
  check (date_fin >= date_debut)
);
create index on public.taches (projet_id);

-- ─── Rapports de chantier ───

create table public.rapports (
  id                     uuid primary key default gen_random_uuid(),
  entreprise_id          uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id              uuid not null references public.projets(id) on delete cascade,
  lot_id                 uuid references public.lots(id) on delete set null,
  auteur_id              uuid not null default auth.uid() references public.profils(id) on delete cascade,
  date_rapport           date not null default current_date,
  meteo                  text,
  effectif               integer check (effectif >= 0),
  travaux                text not null,
  incidents              text,
  besoins                text,
  avancement             integer check (avancement between 0 and 100),
  statut                 text not null default 'soumis' check (statut in ('soumis','valide','rejete')),
  commentaire_validation text,
  valide_par             uuid references public.profils(id) on delete set null,
  valide_at              timestamptz,
  created_at             timestamptz not null default now()
);
create index on public.rapports (projet_id, date_rapport desc);
create index on public.rapports (auteur_id);

create table public.rapport_photos (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  rapport_id    uuid not null references public.rapports(id) on delete cascade,
  chemin        text not null,
  created_at    timestamptz not null default now()
);
create index on public.rapport_photos (rapport_id);

-- ─── Achats ───

create table public.fournisseurs (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  nom           text not null,
  contact       text,
  telephone     text,
  email         text,
  created_at    timestamptz not null default now()
);

create table public.commandes (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id      uuid not null references public.projets(id) on delete cascade,
  lot_id         uuid references public.lots(id) on delete set null,
  fournisseur_id uuid references public.fournisseurs(id) on delete set null,
  reference      text,
  designation    text not null,
  montant        numeric(16,2) not null check (montant >= 0),
  statut         text not null default 'commandee' check (statut in ('demandee','commandee','livree','annulee')),
  date_commande  date not null default current_date,
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.commandes (projet_id);

-- ─── Comptabilité ───

create table public.factures (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id      uuid not null references public.projets(id) on delete cascade,
  lot_id         uuid references public.lots(id) on delete set null,
  fournisseur_id uuid references public.fournisseurs(id) on delete set null,
  commande_id    uuid references public.commandes(id) on delete set null,
  categorie      text not null default 'materiaux' check (categorie in ('materiaux','main_oeuvre','location','sous_traitance','autre')),
  numero         text,
  libelle        text not null,
  montant        numeric(16,2) not null check (montant >= 0),
  date_facture   date not null default current_date,
  date_echeance  date,
  statut         text not null default 'a_payer' check (statut in ('a_payer','payee')),
  date_paiement  date,
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.factures (projet_id);
-- Un même numéro de facture ne peut pas être saisi deux fois pour un même fournisseur
create unique index factures_numero_unique on public.factures (entreprise_id, fournisseur_id, numero)
  where numero is not null and fournisseur_id is not null;

-- ─── Stock ───

create table public.articles (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  nom           text not null,
  unite         text not null default 'u',
  seuil_min     numeric(14,2) not null default 0 check (seuil_min >= 0),
  prix_unitaire numeric(16,2) not null default 0 check (prix_unitaire >= 0),
  created_at    timestamptz not null default now()
);

create table public.mouvements_stock (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  article_id    uuid not null references public.articles(id) on delete cascade,
  projet_id     uuid references public.projets(id) on delete set null,
  type          text not null check (type in ('entree','sortie')),
  quantite      numeric(14,2) not null check (quantite > 0),
  commentaire   text,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.mouvements_stock (article_id);

-- ─── Flux d'activité et alertes ───
-- Alimenté uniquement par les automatismes ci-dessous.
-- "roles" vide = visible par tous ; sinon réservé aux rôles listés.

create table public.activites (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  projet_id     uuid references public.projets(id) on delete cascade,
  type          text not null,          -- projet | rapport | validation | commande | facture | stock | alerte
  niveau        text not null default 'info' check (niveau in ('info','attention','critique')),
  message       text not null,
  roles         text[],
  acteur_id     uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.activites (entreprise_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────
-- 2. CRÉATION DES COMPTES
-- ───────────────────────────────────────────────────────────────────
-- • Quelqu'un s'inscrit avec un nom d'entreprise → nouvelle entreprise,
--   il en devient la Direction.
-- • Quelqu'un s'inscrit avec un email invité → il rejoint l'entreprise
--   avec le rôle prévu par l'invitation.

create or replace function public.creer_profil_utilisateur() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv  invitations;
  ent  uuid;
  nom_saisi text := nullif(trim(coalesce(new.raw_user_meta_data->>'nom', '')), '');
  nom_entreprise text := nullif(trim(coalesce(new.raw_user_meta_data->>'entreprise', '')), '');
begin
  select * into inv from invitations
   where lower(email) = lower(new.email) and acceptee_at is null
   order by created_at desc limit 1;

  if found then
    insert into profils (id, entreprise_id, nom, email, role)
    values (new.id, inv.entreprise_id, coalesce(nom_saisi, inv.nom, split_part(new.email, '@', 1)), new.email, inv.role);
    update invitations set acceptee_at = now() where id = inv.id;
    insert into activites (entreprise_id, type, message, acteur_id)
    values (inv.entreprise_id, 'equipe',
            coalesce(nom_saisi, inv.nom, new.email) || ' a rejoint l''équipe (' || inv.role || ')', new.id);
  elsif nom_entreprise is not null then
    insert into entreprises (nom) values (nom_entreprise) returning id into ent;
    insert into profils (id, entreprise_id, nom, email, role)
    values (new.id, ent, coalesce(nom_saisi, split_part(new.email, '@', 1)), new.email, 'direction');
  end if;
  return new;
end $$;

create trigger koordin_nouvel_utilisateur
  after insert on auth.users
  for each row execute function public.creer_profil_utilisateur();

-- Pour une personne déjà inscrite (sans entreprise) qui reçoit ensuite une invitation
create or replace function public.accepter_invitation() returns boolean
language plpgsql security definer set search_path = public as $$
declare inv invitations; u auth.users;
begin
  if exists (select 1 from profils where id = auth.uid()) then
    return true;
  end if;
  select * into u from auth.users where id = auth.uid();
  select * into inv from invitations
   where lower(email) = lower(u.email) and acceptee_at is null
   order by created_at desc limit 1;
  if not found then
    return false;
  end if;
  insert into profils (id, entreprise_id, nom, email, role)
  values (u.id, inv.entreprise_id,
          coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'nom', '')), ''), inv.nom, split_part(u.email, '@', 1)),
          u.email, inv.role);
  update invitations set acceptee_at = now() where id = inv.id;
  return true;
end $$;
grant execute on function public.accepter_invitation() to authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 3. RÈGLES DE SÉCURITÉ (qui voit / modifie quoi)
-- ───────────────────────────────────────────────────────────────────

alter table public.entreprises      enable row level security;
alter table public.profils          enable row level security;
alter table public.invitations      enable row level security;
alter table public.projets          enable row level security;
alter table public.affectations     enable row level security;
alter table public.lots             enable row level security;
alter table public.taches           enable row level security;
alter table public.rapports         enable row level security;
alter table public.rapport_photos   enable row level security;
alter table public.fournisseurs     enable row level security;
alter table public.commandes        enable row level security;
alter table public.factures         enable row level security;
alter table public.articles         enable row level security;
alter table public.mouvements_stock enable row level security;
alter table public.activites        enable row level security;

-- Entreprise
create policy entreprise_lecture on public.entreprises for select using (id = public.mon_entreprise());
create policy entreprise_modif   on public.entreprises for update using (id = public.mon_entreprise() and public.a_role('direction'))
                                                     with check (id = public.mon_entreprise());

-- Équipe : tout le monde voit ses collègues ; seule la Direction gère.
create policy profils_lecture on public.profils for select using (entreprise_id = public.mon_entreprise());
create policy profils_modif   on public.profils for update
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction'))
  with check (entreprise_id = public.mon_entreprise());

create policy invitations_direction on public.invitations for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction'));

-- Projets
-- Les colonnes de la ligne sont lues directement (et non via voit_projet) pour que
-- la ligne venant d'être créée soit lisible dans la même requête (insert … returning).
create policy projets_lecture on public.projets for select
  using (entreprise_id = public.mon_entreprise()
         and (public.mon_role() <> 'technicien'
              or exists (select 1 from public.affectations a where a.projet_id = projets.id and a.profil_id = auth.uid())));
create policy projets_creation on public.projets for insert
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'));
create policy projets_modif on public.projets for update
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'))
  with check (entreprise_id = public.mon_entreprise());
create policy projets_suppression on public.projets for delete
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction'));

-- Affectations
create policy affectations_lecture on public.affectations for select using (entreprise_id = public.mon_entreprise());
create policy affectations_gestion on public.affectations for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur') and public.voit_projet(projet_id));

-- Lots et planning : lecture pour ceux qui voient le projet, gestion Direction / Coordination
create policy lots_lecture on public.lots for select using (public.voit_projet(projet_id));
create policy lots_gestion on public.lots for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur') and public.voit_projet(projet_id));

create policy taches_lecture on public.taches for select using (public.voit_projet(projet_id));
create policy taches_gestion on public.taches for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur') and public.voit_projet(projet_id));

-- Rapports : Direction et Coordination voient tout ; chaque auteur voit les siens.
create policy rapports_lecture on public.rapports for select
  using (entreprise_id = public.mon_entreprise()
         and (public.a_role('direction','coordinateur') or auteur_id = auth.uid()));
create policy rapports_creation on public.rapports for insert
  with check (entreprise_id = public.mon_entreprise()
              and auteur_id = auth.uid()
              and statut = 'soumis'
              and public.a_role('technicien','coordinateur','direction')
              and public.voit_projet(projet_id));
-- L'auteur peut corriger son rapport tant qu'il n'est pas validé ;
-- Direction / Coordination le valident ou le rejettent.
create policy rapports_modif on public.rapports for update
  using (entreprise_id = public.mon_entreprise()
         and (public.a_role('direction','coordinateur') or (auteur_id = auth.uid() and statut = 'soumis')))
  with check (entreprise_id = public.mon_entreprise()
              and (public.a_role('direction','coordinateur') or (auteur_id = auth.uid() and statut = 'soumis')));
create policy rapports_suppression on public.rapports for delete
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction'));

create policy photos_lecture on public.rapport_photos for select
  using (exists (select 1 from public.rapports r where r.id = rapport_id));
create policy photos_ajout on public.rapport_photos for insert
  with check (entreprise_id = public.mon_entreprise()
              and exists (select 1 from public.rapports r where r.id = rapport_id
                          and (r.auteur_id = auth.uid() or public.a_role('direction','coordinateur'))));

-- Fournisseurs
create policy fournisseurs_lecture on public.fournisseurs for select
  using (entreprise_id = public.mon_entreprise() and not public.a_role('technicien'));
create policy fournisseurs_gestion on public.fournisseurs for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','achats','comptable'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','achats','comptable'));

-- Commandes : gérées par les Achats (et la Direction)
create policy commandes_lecture on public.commandes for select
  using (entreprise_id = public.mon_entreprise()
         and public.a_role('direction','coordinateur','achats','comptable','magasinier'));
create policy commandes_gestion on public.commandes for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','achats'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','achats') and public.voit_projet(projet_id));

-- Factures et dépenses : gérées par la Comptabilité (et la Direction)
create policy factures_lecture on public.factures for select
  using (entreprise_id = public.mon_entreprise()
         and public.a_role('direction','coordinateur','achats','comptable'));
create policy factures_gestion on public.factures for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','comptable'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','comptable') and public.voit_projet(projet_id));

-- Stock : visible par toute l'entreprise, géré par le Magasinier (et Direction / Achats pour le catalogue)
create policy articles_lecture on public.articles for select using (entreprise_id = public.mon_entreprise());
create policy articles_gestion on public.articles for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','magasinier','achats'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','magasinier','achats'));

create policy mouvements_lecture on public.mouvements_stock for select using (entreprise_id = public.mon_entreprise());
create policy mouvements_ajout on public.mouvements_stock for insert
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','magasinier'));
create policy mouvements_suppression on public.mouvements_stock for delete
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction'));

-- Activités
create policy activites_lecture on public.activites for select
  using (entreprise_id = public.mon_entreprise()
         and (roles is null or public.mon_role() = any(roles))
         and (projet_id is null or public.voit_projet(projet_id)));

-- ───────────────────────────────────────────────────────────────────
-- 4. AUTOMATISMES
-- ───────────────────────────────────────────────────────────────────

create or replace function public.ajouter_activite(
  p_entreprise uuid, p_projet uuid, p_type text, p_niveau text, p_message text, p_roles text[] default null
) returns void
language sql security definer set search_path = public as $$
  insert into activites (entreprise_id, projet_id, type, niveau, message, roles, acteur_id)
  values (p_entreprise, p_projet, p_type, p_niveau, p_message, p_roles, auth.uid());
$$;
revoke execute on function public.ajouter_activite(uuid, uuid, text, text, text, text[]) from public, anon, authenticated;

create or replace function public.nom_utilisateur(u uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select nom from profils where id = u), 'Quelqu''un')
$$;

create or replace function public.maj_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger projets_updated_at before update on public.projets
  for each row execute function public.maj_updated_at();

-- Projet créé
create or replace function public.trg_projet_cree() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform ajouter_activite(new.entreprise_id, new.id, 'projet', 'info',
    nom_utilisateur(auth.uid()) || ' a créé le projet « ' || new.nom || ' »');
  return new;
end $$;
create trigger projet_cree after insert on public.projets
  for each row execute function public.trg_projet_cree();

-- Rapport soumis / validé / rejeté
create or replace function public.trg_rapport() returns trigger
language plpgsql security definer set search_path = public as $$
declare nom_projet text;
begin
  select nom into nom_projet from projets where id = new.projet_id;
  if tg_op = 'INSERT' then
    perform ajouter_activite(new.entreprise_id, new.projet_id, 'rapport',
      case when coalesce(trim(new.incidents), '') <> '' then 'attention' else 'info' end,
      nom_utilisateur(new.auteur_id) || ' a envoyé un rapport sur « ' || nom_projet || ' »'
        || case when coalesce(trim(new.incidents), '') <> '' then ' — incident signalé' else '' end,
      array['direction','coordinateur']);
  elsif new.statut is distinct from old.statut and new.statut in ('valide','rejete') then
    new.valide_par := auth.uid();
    new.valide_at := now();
    -- Un rapport validé met à jour l'avancement du lot concerné
    if new.statut = 'valide' and new.lot_id is not null and new.avancement is not null then
      update lots set avancement = new.avancement where id = new.lot_id;
    end if;
    perform ajouter_activite(new.entreprise_id, new.projet_id, 'validation', 'info',
      nom_utilisateur(auth.uid()) || case when new.statut = 'valide' then ' a validé' else ' a rejeté' end
        || ' le rapport de ' || nom_utilisateur(new.auteur_id) || ' (' || nom_projet || ')',
      array['direction','coordinateur']);
  end if;
  return new;
end $$;
create trigger rapport_insert after insert on public.rapports
  for each row execute function public.trg_rapport();
create trigger rapport_update before update on public.rapports
  for each row execute function public.trg_rapport();

-- Budget : contrôle après chaque commande ou facture
create or replace function public.controler_budget(p_projet uuid, p_lot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pr projets; lt lots;
  engage numeric; facture numeric; depense numeric;
  roles_fin text[] := array['direction','coordinateur','achats','comptable'];
begin
  select * into pr from projets where id = p_projet;
  select coalesce(sum(montant), 0) into engage from commandes where projet_id = p_projet and statut <> 'annulee';
  select coalesce(sum(montant), 0) into facture from factures where projet_id = p_projet;
  depense := greatest(engage, facture);
  if pr.budget > 0 and depense > pr.budget then
    perform ajouter_activite(pr.entreprise_id, pr.id, 'alerte', 'critique',
      'Budget dépassé sur « ' || pr.nom || ' » : ' || round(depense / pr.budget * 100) || ' % du budget consommé', roles_fin);
  elsif pr.budget > 0 and depense > pr.budget * 0.9 then
    perform ajouter_activite(pr.entreprise_id, pr.id, 'alerte', 'attention',
      'Budget presque épuisé sur « ' || pr.nom || ' » : ' || round(depense / pr.budget * 100) || ' % consommé', roles_fin);
  end if;

  if p_lot is not null then
    select * into lt from lots where id = p_lot;
    select coalesce(sum(montant), 0) into engage from commandes where lot_id = p_lot and statut <> 'annulee';
    select coalesce(sum(montant), 0) into facture from factures where lot_id = p_lot;
    depense := greatest(engage, facture);
    if lt.budget > 0 and depense > lt.budget then
      perform ajouter_activite(pr.entreprise_id, pr.id, 'alerte', 'critique',
        'Lot « ' || lt.nom || ' » (' || pr.nom || ') hors budget : ' || round(depense / lt.budget * 100) || ' %', roles_fin);
    end if;
  end if;
end $$;
revoke execute on function public.controler_budget(uuid, uuid) from public, anon, authenticated;

create or replace function public.trg_commande() returns trigger
language plpgsql security definer set search_path = public as $$
declare nom_projet text;
begin
  select nom into nom_projet from projets where id = new.projet_id;
  if tg_op = 'INSERT' then
    perform ajouter_activite(new.entreprise_id, new.projet_id, 'commande', 'info',
      nom_utilisateur(auth.uid()) || ' a enregistré la commande « ' || new.designation || ' » (' || nom_projet || ')',
      array['direction','coordinateur','achats','comptable','magasinier']);
  elsif new.statut = 'livree' and old.statut <> 'livree' then
    perform ajouter_activite(new.entreprise_id, new.projet_id, 'commande', 'info',
      'Commande « ' || new.designation || ' » réceptionnée (' || nom_projet || ')',
      array['direction','coordinateur','achats','comptable','magasinier']);
  end if;
  perform controler_budget(new.projet_id, new.lot_id);
  return new;
end $$;
create trigger commande_maj after insert or update on public.commandes
  for each row execute function public.trg_commande();

-- Factures : flux + détection de double facturation
create or replace function public.trg_facture() returns trigger
language plpgsql security definer set search_path = public as $$
declare nom_projet text; doublon factures;
begin
  select nom into nom_projet from projets where id = new.projet_id;
  if tg_op = 'INSERT' then
    perform ajouter_activite(new.entreprise_id, new.projet_id, 'facture', 'info',
      nom_utilisateur(auth.uid()) || ' a saisi « ' || new.libelle || ' » (' || nom_projet || ')',
      array['direction','coordinateur','achats','comptable']);
    if new.fournisseur_id is not null then
      select * into doublon from factures
       where fournisseur_id = new.fournisseur_id and id <> new.id and montant = new.montant
         and abs(date_facture - new.date_facture) <= 60
       limit 1;
      if found then
        perform ajouter_activite(new.entreprise_id, new.projet_id, 'alerte', 'critique',
          'Double facturation possible : même fournisseur, même montant que la facture '
            || coalesce(doublon.numero, doublon.libelle) || ' du ' || to_char(doublon.date_facture, 'DD/MM/YYYY'),
          array['direction','comptable']);
      end if;
    end if;
  end if;
  perform controler_budget(new.projet_id, new.lot_id);
  return new;
end $$;
create trigger facture_maj after insert or update on public.factures
  for each row execute function public.trg_facture();

-- Stock : interdit les sorties supérieures au stock et alerte sous le seuil
create or replace function public.trg_mouvement_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare art articles; qte numeric; nom_projet text;
begin
  select * into art from articles where id = new.article_id for update;
  select coalesce(sum(case when type = 'entree' then quantite else -quantite end), 0)
    into qte from mouvements_stock where article_id = new.article_id;
  if new.type = 'sortie' and new.quantite > qte then
    raise exception 'Stock insuffisant pour « % » : % % disponibles', art.nom, trim_scale(qte), art.unite;
  end if;
  qte := qte + case when new.type = 'entree' then new.quantite else -new.quantite end;
  if new.type = 'sortie' then
    select nom into nom_projet from projets where id = new.projet_id;
    perform ajouter_activite(new.entreprise_id, new.projet_id, 'stock', 'info',
      'Sortie de ' || trim_scale(new.quantite) || ' ' || art.unite || ' de « ' || art.nom || ' »'
        || coalesce(' vers ' || nom_projet, ''),
      array['direction','coordinateur','magasinier','achats']);
    if qte < art.seuil_min then
      perform ajouter_activite(new.entreprise_id, null, 'alerte', 'attention',
        'Stock bas : « ' || art.nom || ' » à ' || trim_scale(qte) || ' ' || art.unite || ' (seuil ' || trim_scale(art.seuil_min) || ')',
        array['direction','coordinateur','magasinier','achats']);
    end if;
  end if;
  return new;
end $$;
create trigger mouvement_stock_controle before insert on public.mouvements_stock
  for each row execute function public.trg_mouvement_stock();

-- Réception d'une commande par le Magasinier (sans pouvoir modifier le montant)
create or replace function public.receptionner_commande(p_commande uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.a_role('direction','achats','magasinier') then
    raise exception 'Action non autorisée';
  end if;
  update commandes set statut = 'livree'
   where id = p_commande and entreprise_id = public.mon_entreprise() and statut = 'commandee';
  if not found then
    raise exception 'Commande introuvable ou déjà traitée';
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────
-- 5. VUES DE SYNTHÈSE
-- Elles respectent les règles de sécurité de la personne qui les lit
-- (security_invoker) : un technicien ne voit pas les montants.
-- ───────────────────────────────────────────────────────────────────

create view public.v_budget_lots with (security_invoker = true) as
select
  l.id, l.projet_id, l.entreprise_id, l.nom, l.budget, l.avancement, l.ordre,
  coalesce((select sum(c.montant) from public.commandes c where c.lot_id = l.id and c.statut <> 'annulee'), 0) as engage,
  coalesce((select sum(f.montant) from public.factures f where f.lot_id = l.id), 0) as facture,
  coalesce((select sum(f.montant) from public.factures f where f.lot_id = l.id and f.statut = 'payee'), 0) as paye
from public.lots l;

create view public.v_projets with (security_invoker = true) as
with base as (
  select
    p.*,
    coalesce((
      select case when sum(l.budget) > 0
                  then round(sum(l.avancement * l.budget) / sum(l.budget))
                  else round(avg(l.avancement)) end
      from public.lots l where l.projet_id = p.id), 0)::int as avancement,
    case
      when p.date_debut is null or p.date_fin_prevue is null or p.date_fin_prevue <= p.date_debut then null
      when current_date <= p.date_debut then 0
      when current_date >= p.date_fin_prevue then 100
      else round((current_date - p.date_debut)::numeric / (p.date_fin_prevue - p.date_debut) * 100)
    end::int as avancement_attendu,
    coalesce((select sum(c.montant) from public.commandes c where c.projet_id = p.id and c.statut <> 'annulee'), 0) as engage,
    coalesce((select sum(f.montant) from public.factures f where f.projet_id = p.id), 0) as facture,
    coalesce((select sum(f.montant) from public.factures f where f.projet_id = p.id and f.statut = 'payee'), 0) as paye,
    (select count(*) from public.rapports r where r.projet_id = p.id and r.statut = 'soumis')::int as rapports_en_attente,
    (select max(r.date_rapport) from public.rapports r where r.projet_id = p.id) as dernier_rapport,
    (select count(*) from public.affectations a where a.projet_id = p.id)::int as equipe
  from public.projets p
)
select
  b.*,
  case when b.statut <> 'termine' and b.date_fin_prevue < current_date
       then current_date - b.date_fin_prevue else 0 end as jours_de_retard,
  case
    when b.statut = 'termine' then 'termine'
    when (b.budget > 0 and greatest(b.engage, b.facture) > b.budget)
      or (b.avancement_attendu is not null and b.avancement_attendu - b.avancement > 15)
      or (b.date_fin_prevue < current_date)
      then 'critique'
    when (b.budget > 0 and greatest(b.engage, b.facture) > b.budget * 0.9)
      or (b.avancement_attendu is not null and b.avancement_attendu - b.avancement > 5)
      then 'attention'
    else 'ok'
  end as sante
from base b;

create view public.v_stock with (security_invoker = true) as
select
  a.*,
  coalesce((select sum(case when m.type = 'entree' then m.quantite else -m.quantite end)
            from public.mouvements_stock m where m.article_id = a.id), 0) as quantite,
  coalesce((select sum(case when m.type = 'entree' then m.quantite else -m.quantite end)
            from public.mouvements_stock m where m.article_id = a.id), 0) < a.seuil_min as alerte
from public.articles a;

grant select on public.v_projets, public.v_budget_lots, public.v_stock to authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 6. PHOTOS DE CHANTIER (Supabase Storage)
-- Rangées par entreprise : <entreprise_id>/<rapport_id>/<fichier>.jpg
-- ───────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-chantier', 'photos-chantier', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy photos_chantier_lecture on storage.objects for select to authenticated
  using (bucket_id = 'photos-chantier' and (storage.foldername(name))[1] = public.mon_entreprise()::text);
create policy photos_chantier_envoi on storage.objects for insert to authenticated
  with check (bucket_id = 'photos-chantier'
              and (storage.foldername(name))[1] = public.mon_entreprise()::text
              and public.a_role('technicien','coordinateur','direction'));

-- ───────────────────────────────────────────────────────────────────
-- Temps réel : le flux d'activité et les rapports s'affichent en direct
-- ───────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activites, public.rapports;
  end if;
end $$;

-- ───────────────────────────────────────────────────────────────────
-- 7. DONNÉES DE DÉMONSTRATION
-- Bouton « Charger la démo » dans Paramètres (Direction uniquement).
-- ───────────────────────────────────────────────────────────────────

create or replace function public.charger_demo() returns void
language plpgsql security definer set search_path = public as $$
declare
  ent uuid := public.mon_entreprise();
  moi uuid := auth.uid();
  p1 uuid; p2 uuid; p3 uuid;
  l uuid[] := '{}'; lid uuid;
  f1 uuid; f2 uuid; f3 uuid;
  a1 uuid; a2 uuid; a3 uuid;
  r1 uuid;
begin
  if not public.a_role('direction') then
    raise exception 'Réservé à la Direction';
  end if;

  insert into projets (entreprise_id, nom, reference, client, localisation, budget, date_debut, date_fin_prevue, created_by)
  values (ent, 'Tour Ivoire — Bâtiment B', 'TIV-B-2026', 'SCI Ivoire Horizon', 'Plateau, Abidjan', 2800000000,
          current_date - 200, current_date + 90, moi) returning id into p1;
  insert into projets (entreprise_id, nom, reference, client, localisation, budget, date_debut, date_fin_prevue, created_by)
  values (ent, 'Résidence Émeraude', 'EME-2026', 'Groupe Émeraude', 'Cocody Riviera 3', 1500000000,
          current_date - 120, current_date + 150, moi) returning id into p2;
  insert into projets (entreprise_id, nom, reference, client, localisation, budget, date_debut, date_fin_prevue, created_by)
  values (ent, 'Lycée Technique Yopougon', 'LTY-2026', 'Ministère de l''Éducation', 'Yopougon', 950000000,
          current_date - 60, current_date + 240, moi) returning id into p3;

  -- Lots
  insert into lots (entreprise_id, projet_id, nom, budget, avancement, ordre) values
    (ent, p1, 'Gros œuvre', 1400000000, 78, 1),
    (ent, p1, 'Électricité', 450000000, 35, 2),
    (ent, p1, 'Plomberie', 350000000, 30, 3),
    (ent, p1, 'Finitions', 600000000, 5, 4),
    (ent, p2, 'Gros œuvre', 700000000, 60, 1),
    (ent, p2, 'Électricité', 250000000, 40, 2),
    (ent, p2, 'Menuiserie', 300000000, 10, 3),
    (ent, p2, 'Peinture', 250000000, 0, 4),
    (ent, p3, 'Terrassement', 150000000, 90, 1),
    (ent, p3, 'Gros œuvre', 500000000, 15, 2),
    (ent, p3, 'Second œuvre', 300000000, 0, 3);

  -- Planning
  insert into taches (entreprise_id, projet_id, lot_id, nom, date_debut, date_fin, avancement)
  select ent, p1, l.id, t.nom, current_date + t.d1, current_date + t.d2, t.av
  from (values ('Gros œuvre','Fondations', -200, -150, 100),
               ('Gros œuvre','Élévation R+1 à R+4', -150, -20, 85),
               ('Gros œuvre','Dalle toiture', -20, 15, 20),
               ('Électricité','Réseaux encastrés', -60, 30, 40),
               ('Plomberie','Colonnes montantes', -45, 25, 30),
               ('Finitions','Carrelage et peinture', 20, 90, 0)) as t(lot, nom, d1, d2, av)
  join lots l on l.projet_id = p1 and l.nom = t.lot;

  insert into taches (entreprise_id, projet_id, lot_id, nom, date_debut, date_fin, avancement)
  select ent, p2, l.id, t.nom, current_date + t.d1, current_date + t.d2, t.av
  from (values ('Gros œuvre','Structure béton', -120, 10, 60),
               ('Électricité','Câblage logements', -40, 60, 40),
               ('Menuiserie','Pose menuiseries', 0, 90, 10),
               ('Peinture','Peinture intérieure', 80, 150, 0)) as t(lot, nom, d1, d2, av)
  join lots l on l.projet_id = p2 and l.nom = t.lot;

  insert into taches (entreprise_id, projet_id, lot_id, nom, date_debut, date_fin, avancement)
  select ent, p3, l.id, t.nom, current_date + t.d1, current_date + t.d2, t.av
  from (values ('Terrassement','Décapage et fouilles', -60, -10, 90),
               ('Gros œuvre','Fondations et élévation', -15, 150, 15),
               ('Second œuvre','Électricité, plomberie, menuiserie', 120, 240, 0)) as t(lot, nom, d1, d2, av)
  join lots l on l.projet_id = p3 and l.nom = t.lot;

  -- Fournisseurs
  insert into fournisseurs (entreprise_id, nom, contact, telephone) values (ent, 'SOACOFER', 'Service commercial', '+225 27 21 00 00 01') returning id into f1;
  insert into fournisseurs (entreprise_id, nom, contact, telephone) values (ent, 'ELECTRA CI', 'M. Koné', '+225 07 00 00 00 02') returning id into f2;
  insert into fournisseurs (entreprise_id, nom, contact, telephone) values (ent, 'Ciments d''Abidjan', 'Agence Yopougon', '+225 05 00 00 00 03') returning id into f3;

  -- Commandes (Résidence Émeraude électricité volontairement proche du dépassement)
  select id into lid from lots where projet_id = p1 and nom = 'Gros œuvre';
  insert into commandes (entreprise_id, projet_id, lot_id, fournisseur_id, reference, designation, montant, statut, date_commande, created_by)
  values (ent, p1, lid, f1, 'BC-0101', 'Acier HA 12 mm — 40 t', 380000000, 'livree', current_date - 90, moi),
         (ent, p1, lid, f3, 'BC-0102', 'Ciment CPJ 42.5 — 2 000 sacs', 210000000, 'livree', current_date - 60, moi),
         (ent, p1, lid, f1, 'BC-0103', 'Acier HA 10 mm — 25 t', 230000000, 'commandee', current_date - 5, moi);
  select id into lid from lots where projet_id = p2 and nom = 'Électricité';
  insert into commandes (entreprise_id, projet_id, lot_id, fournisseur_id, reference, designation, montant, statut, date_commande, created_by)
  values (ent, p2, lid, f2, 'BC-0201', 'Câbles et gaines — tranche 1', 160000000, 'livree', current_date - 50, moi),
         (ent, p2, lid, f2, 'BC-0202', 'Tableaux électriques', 75000000, 'commandee', current_date - 8, moi);
  select id into lid from lots where projet_id = p3 and nom = 'Terrassement';
  insert into commandes (entreprise_id, projet_id, lot_id, fournisseur_id, reference, designation, montant, statut, date_commande, created_by)
  values (ent, p3, lid, null, 'BC-0301', 'Location pelle mécanique — 6 semaines', 95000000, 'livree', current_date - 55, moi);

  -- Factures
  select id into lid from lots where projet_id = p1 and nom = 'Gros œuvre';
  insert into factures (entreprise_id, projet_id, lot_id, fournisseur_id, categorie, numero, libelle, montant, date_facture, date_echeance, statut, date_paiement, created_by)
  values (ent, p1, lid, f1, 'materiaux', 'SOA-2026-118', 'Acier HA 12 mm — 40 t', 380000000, current_date - 85, current_date - 55, 'payee', current_date - 56, moi),
         (ent, p1, lid, f3, 'materiaux', 'CIM-4471', 'Ciment CPJ 42.5', 210000000, current_date - 55, current_date - 25, 'payee', current_date - 30, moi),
         (ent, p1, lid, null, 'main_oeuvre', null, 'Main-d''œuvre gros œuvre — mois précédent', 145000000, current_date - 20, current_date + 10, 'a_payer', null, moi);
  select id into lid from lots where projet_id = p2 and nom = 'Électricité';
  insert into factures (entreprise_id, projet_id, lot_id, fournisseur_id, categorie, numero, libelle, montant, date_facture, date_echeance, statut, created_by)
  values (ent, p2, lid, f2, 'materiaux', 'FAC-087', 'Câbles et gaines — tranche 1', 160000000, current_date - 45, current_date - 5, 'a_payer', moi);

  -- Stock
  insert into articles (entreprise_id, nom, unite, seuil_min, prix_unitaire) values (ent, 'Ciment CPJ 42.5', 'sac', 300, 5500) returning id into a1;
  insert into articles (entreprise_id, nom, unite, seuil_min, prix_unitaire) values (ent, 'Acier HA 12 mm', 'barre', 200, 9500) returning id into a2;
  insert into articles (entreprise_id, nom, unite, seuil_min, prix_unitaire) values (ent, 'Sable de rivière', 'm³', 30, 14000) returning id into a3;
  insert into mouvements_stock (entreprise_id, article_id, type, quantite, commentaire, created_by) values
    (ent, a1, 'entree', 1200, 'Livraison BC-0102', moi),
    (ent, a2, 'entree', 600, 'Livraison BC-0101', moi),
    (ent, a3, 'entree', 80, 'Livraison carrière', moi);
  insert into mouvements_stock (entreprise_id, article_id, projet_id, type, quantite, commentaire, created_by) values
    (ent, a1, p1, 'sortie', 700, 'Coulage dalle R+4', moi),
    (ent, a2, p1, 'sortie', 450, 'Ferraillage R+4', moi),
    (ent, a3, p2, 'sortie', 45, 'Maçonnerie', moi);

  -- Rapports
  select id into lid from lots where projet_id = p1 and nom = 'Gros œuvre';
  insert into rapports (entreprise_id, projet_id, lot_id, auteur_id, date_rapport, meteo, effectif, travaux, incidents, besoins, avancement, statut)
  values (ent, p1, lid, moi, current_date - 1, 'Pluie', 18, 'Ferraillage poteaux R+4, coffrage partiel de la dalle.',
          'Arrêt de 3 h à cause de la pluie. 6 ouvriers absents.', 'Acier HA 10 mm à livrer rapidement.', 80, 'soumis')
  returning id into r1;
  select id into lid from lots where projet_id = p2 and nom = 'Électricité';
  insert into rapports (entreprise_id, projet_id, lot_id, auteur_id, date_rapport, meteo, effectif, travaux, avancement, statut)
  values (ent, p2, lid, moi, current_date - 2, 'Ensoleillé', 9, 'Tirage des câbles bâtiment A, niveaux 1 à 3.', 40, 'soumis');
end $$;

grant execute on function public.charger_demo() to authenticated;
grant execute on function public.receptionner_commande(uuid) to authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 8. MOT DE PASSE D'UN MEMBRE (comptes créés avec un numéro de téléphone)
-- Un compte sans email ne peut pas recevoir de lien « mot de passe oublié » :
-- la Direction choisit alors un nouveau mot de passe depuis l'écran Équipe.
-- ───────────────────────────────────────────────────────────────────
create or replace function public.changer_mot_de_passe_membre(p_profil uuid, p_mot_de_passe text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.a_role('direction') then
    raise exception 'Réservé à la Direction';
  end if;
  if length(coalesce(p_mot_de_passe, '')) < 8 then
    raise exception 'Le mot de passe doit contenir au moins 8 caractères.';
  end if;
  if not exists (select 1 from profils where id = p_profil and entreprise_id = public.mon_entreprise()) then
    raise exception 'Membre introuvable';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_mot_de_passe, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_profil;
end $$;
revoke execute on function public.changer_mot_de_passe_membre(uuid, text) from public, anon;
grant execute on function public.changer_mot_de_passe_membre(uuid, text) to authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 9. CORRECTIF : création de projet refusée (« pas l'autorisation »)
-- La règle de lecture des projets est réécrite pour accepter la ligne
-- qui vient d'être créée. Sans effet si elle est déjà à jour.
-- ───────────────────────────────────────────────────────────────────
drop policy if exists projets_lecture on public.projets;
create policy projets_lecture on public.projets for select
  using (entreprise_id = public.mon_entreprise()
         and (public.mon_role() <> 'technicien'
              or exists (select 1 from public.affectations a where a.projet_id = projets.id and a.profil_id = auth.uid())));

-- ═══════════════════════════════════════════════════════════════════
-- 10. LICENCES ET ABONNEMENTS
-- • Chaque entreprise a une formule (plan) et une date de fin de licence.
-- • Nouvelle entreprise : essai gratuit (14 jours par défaut).
-- • Licence expirée : lecture seule (aucune création ni modification).
-- • Paiement manuel : la Direction déclare son paiement Mobile Money,
--   le propriétaire de KOORDIN le valide depuis la console, la licence
--   est prolongée automatiquement.
-- Bloc ré-exécutable sans risque (sert aussi de mise à jour).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.plans (
  code             text primary key,
  nom              text not null,
  description      text,
  prix_mensuel     numeric(14,2) not null default 0,
  max_projets      integer,          -- vide = illimité
  max_utilisateurs integer,          -- vide = illimité
  ordre            integer not null default 0,
  public           boolean not null default true   -- proposé aux clients
);

insert into public.plans (code, nom, description, prix_mensuel, max_projets, max_utilisateurs, ordre, public) values
  ('essai',    'Essai gratuit', 'Toutes les fonctions pour découvrir KOORDIN', 0, 5, 15, 0, false),
  ('starter',  'Starter',  'Pour une petite entreprise ou un premier chantier', 98000, 3, 10, 1, true),
  ('pro',      'Pro',      'Pour une entreprise avec plusieurs chantiers en parallèle', 229000, 15, 50, 2, true),
  ('business', 'Business', 'Pour les grandes entreprises multi-sites', 459000, 30, 150, 3, true)
on conflict (code) do nothing;

create table if not exists public.parametres_plateforme (
  cle    text primary key,
  valeur text
);
insert into public.parametres_plateforme (cle, valeur) values
  ('duree_essai_jours', '14'),
  ('remise_trimestre_pct', '10'),
  ('remise_annee_pct', '20'),
  ('paiement_wave', ''),
  ('paiement_orange_money', ''),
  ('paiement_beneficiaire', ''),
  ('contact_whatsapp', '')
on conflict (cle) do nothing;

create table if not exists public.admins_plateforme (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.entreprises add column if not exists plan text not null default 'essai' references public.plans(code);
alter table public.entreprises add column if not exists licence_fin timestamptz;
update public.entreprises set licence_fin = now() + interval '14 days' where licence_fin is null;
alter table public.entreprises alter column licence_fin set not null;
alter table public.entreprises alter column licence_fin set default now() + interval '14 days';

create table if not exists public.paiements (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  plan          text not null references public.plans(code),
  periode       text not null check (periode in ('mois','trimestre','annee')),
  montant       numeric(14,2) not null check (montant >= 0),
  moyen         text not null default 'mobile_money',
  reference     text,
  statut        text not null default 'declare' check (statut in ('declare','valide','refuse')),
  note          text,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  traite_par    uuid references auth.users(id) on delete set null,
  traite_at     timestamptz
);
create index if not exists paiements_entreprise_idx on public.paiements (entreprise_id, created_at desc);

-- ─── Fonctions ───

create or replace function public.est_admin_plateforme() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins_plateforme where user_id = auth.uid())
$$;

create or replace function public.licence_active(p_entreprise uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select licence_fin > now() from entreprises where id = p_entreprise), false)
$$;

create or replace function public.duree_essai() returns interval
language sql stable security definer set search_path = public as $$
  select make_interval(days => coalesce((select nullif(valeur, '')::int from parametres_plateforme where cle = 'duree_essai_jours'), 14))
$$;
alter table public.entreprises alter column licence_fin set default now() + public.duree_essai();

-- Devenir propriétaire de la plateforme : possible une seule fois, quand personne ne l'est encore.
create or replace function public.devenir_admin_plateforme() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from admins_plateforme) then return public.est_admin_plateforme(); end if;
  insert into admins_plateforme (user_id) values (auth.uid());
  -- l'entreprise du propriétaire n'expire pas
  update entreprises set plan = 'business', licence_fin = now() + interval '100 years' where id = public.mon_entreprise();
  return true;
end $$;
create or replace function public.plateforme_a_un_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins_plateforme)
$$;

-- ─── Lecture seule si la licence est expirée ───

create or replace function public.verifier_licence() returns trigger
language plpgsql security definer set search_path = public as $$
declare ent uuid;
begin
  if auth.uid() is null or public.est_admin_plateforme() then
    return coalesce(new, old);
  end if;
  ent := case when tg_op = 'DELETE' then old.entreprise_id else new.entreprise_id end;
  if not public.licence_active(ent) then
    raise exception 'LICENCE_EXPIREE' using hint = 'KOORDIN est en lecture seule : la licence de l''entreprise a expiré.';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['projets','affectations','lots','taches','rapports','rapport_photos','fournisseurs',
                           'commandes','factures','articles','mouvements_stock','invitations']
  loop
    execute format('drop trigger if exists licence_%1$s on public.%1$I', t);
    execute format('create trigger licence_%1$s before insert or update or delete on public.%1$I for each row execute function public.verifier_licence()', t);
  end loop;
end $$;

-- ─── Limites de la formule ───

create or replace function public.verifier_limites() returns trigger
language plpgsql security definer set search_path = public as $$
declare pl plans; n int;
begin
  select p.* into pl from plans p join entreprises e on e.plan = p.code where e.id = new.entreprise_id;
  if tg_table_name = 'projets' and pl.max_projets is not null then
    select count(*) into n from projets where entreprise_id = new.entreprise_id and statut <> 'termine';
    if n >= pl.max_projets then
      raise exception 'LIMITE_PROJETS' using hint = format('La formule %s permet %s projet(s) actif(s).', pl.nom, pl.max_projets);
    end if;
  elsif tg_table_name = 'invitations' and pl.max_utilisateurs is not null then
    select (select count(*) from profils where entreprise_id = new.entreprise_id and actif)
         + (select count(*) from invitations where entreprise_id = new.entreprise_id and acceptee_at is null)
      into n;
    if n >= pl.max_utilisateurs then
      raise exception 'LIMITE_UTILISATEURS' using hint = format('La formule %s permet %s utilisateur(s).', pl.nom, pl.max_utilisateurs);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists limite_projets on public.projets;
create trigger limite_projets before insert on public.projets for each row execute function public.verifier_limites();
drop trigger if exists limite_invitations on public.invitations;
create trigger limite_invitations before insert on public.invitations for each row execute function public.verifier_limites();

-- ─── Règles d'accès ───

alter table public.plans enable row level security;
alter table public.parametres_plateforme enable row level security;
alter table public.admins_plateforme enable row level security;
alter table public.paiements enable row level security;

drop policy if exists plans_lecture on public.plans;
create policy plans_lecture on public.plans for select using (auth.uid() is not null);
drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans for all using (public.est_admin_plateforme()) with check (public.est_admin_plateforme());

drop policy if exists parametres_lecture on public.parametres_plateforme;
create policy parametres_lecture on public.parametres_plateforme for select using (auth.uid() is not null);
drop policy if exists parametres_admin on public.parametres_plateforme;
create policy parametres_admin on public.parametres_plateforme for all using (public.est_admin_plateforme()) with check (public.est_admin_plateforme());

drop policy if exists admins_lecture on public.admins_plateforme;
create policy admins_lecture on public.admins_plateforme for select using (user_id = auth.uid());

drop policy if exists paiements_lecture on public.paiements;
create policy paiements_lecture on public.paiements for select
  using ((entreprise_id = public.mon_entreprise() and public.a_role('direction')) or public.est_admin_plateforme());
drop policy if exists paiements_declaration on public.paiements;
create policy paiements_declaration on public.paiements for insert
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction') and statut = 'declare');

-- La Direction ne peut plus changer elle-même sa formule ni sa date de licence
create or replace function public.proteger_licence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.est_admin_plateforme()
     and (new.plan is distinct from old.plan or new.licence_fin is distinct from old.licence_fin) then
    raise exception 'Seul le propriétaire de KOORDIN peut modifier la licence.';
  end if;
  return new;
end $$;
drop trigger if exists proteger_licence on public.entreprises;
create trigger proteger_licence before update on public.entreprises for each row execute function public.proteger_licence();

-- ─── Console du propriétaire ───

create or replace function public.console_entreprises()
returns table (id uuid, nom text, pays text, plan text, licence_fin timestamptz, created_at timestamptz,
               nb_projets bigint, nb_utilisateurs bigint, direction text, contact text, paiements_en_attente bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin_plateforme() then raise exception 'Réservé au propriétaire de KOORDIN'; end if;
  return query
  select e.id, e.nom, e.pays, e.plan, e.licence_fin, e.created_at,
         (select count(*) from projets p where p.entreprise_id = e.id and p.statut <> 'termine'),
         (select count(*) from profils pr where pr.entreprise_id = e.id and pr.actif),
         (select pr.nom from profils pr where pr.entreprise_id = e.id and pr.role = 'direction' order by pr.created_at limit 1),
         (select pr.email from profils pr where pr.entreprise_id = e.id and pr.role = 'direction' order by pr.created_at limit 1),
         (select count(*) from paiements pa where pa.entreprise_id = e.id and pa.statut = 'declare')
  from entreprises e
  order by e.created_at desc;
end $$;

create or replace function public.prolonger_licence(p_entreprise uuid, p_plan text, p_mois integer) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare fin timestamptz;
begin
  if not public.est_admin_plateforme() then raise exception 'Réservé au propriétaire de KOORDIN'; end if;
  update entreprises
     set plan = coalesce(p_plan, plan),
         licence_fin = greatest(licence_fin, now()) + make_interval(months => p_mois)
   where id = p_entreprise
  returning licence_fin into fin;
  return fin;
end $$;

create or replace function public.traiter_paiement(p_paiement uuid, p_valider boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare pa paiements;
begin
  if not public.est_admin_plateforme() then raise exception 'Réservé au propriétaire de KOORDIN'; end if;
  select * into pa from paiements where id = p_paiement and statut = 'declare' for update;
  if not found then raise exception 'Paiement introuvable ou déjà traité'; end if;
  update paiements set statut = case when p_valider then 'valide' else 'refuse' end,
                       note = coalesce(p_note, note), traite_par = auth.uid(), traite_at = now()
   where id = p_paiement;
  if p_valider then
    perform public.prolonger_licence(pa.entreprise_id, pa.plan,
      case pa.periode when 'mois' then 1 when 'trimestre' then 3 else 12 end);
    insert into activites (entreprise_id, type, niveau, message, roles, acteur_id)
    values (pa.entreprise_id, 'equipe', 'info', 'Paiement validé : votre licence KOORDIN est prolongée.', array['direction'], auth.uid());
  else
    insert into activites (entreprise_id, type, niveau, message, roles, acteur_id)
    values (pa.entreprise_id, 'alerte', 'attention', 'Paiement non validé' || coalesce(' : ' || p_note, '') || '. Contactez KOORDIN.', array['direction'], auth.uid());
  end if;
end $$;

grant select on public.plans, public.parametres_plateforme to authenticated;
grant execute on function public.est_admin_plateforme(), public.licence_active(uuid), public.devenir_admin_plateforme(),
  public.plateforme_a_un_admin(), public.console_entreprises(), public.prolonger_licence(uuid, text, integer),
  public.traiter_paiement(uuid, boolean, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 11. KOORDIN 1.5 : IMAGES ET ANNONCES
-- • Photo de couverture de chaque chantier (Direction, Coordination) ;
--   à défaut, la dernière photo envoyée par le terrain.
-- • Annonces sponsorisées (fournisseurs, loueurs…) gérées par le
--   propriétaire de KOORDIN depuis la console, affichées « Sponsorisé ».
-- • Communiqués : messages de la Direction ou de la Coordination à
--   l'équipe, pour toute l'entreprise ou un seul chantier.
-- Bloc ré-exécutable sans risque (sert aussi de mise à jour).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Photo de couverture ───
alter table public.projets add column if not exists photo text;

-- La vue des projets est recréée pour inclure la photo et la dernière photo du terrain.
drop view if exists public.v_projets;
create view public.v_projets with (security_invoker = true) as
with base as (
  select
    p.*,
    coalesce((
      select case when sum(l.budget) > 0
                  then round(sum(l.avancement * l.budget) / sum(l.budget))
                  else round(avg(l.avancement)) end
      from public.lots l where l.projet_id = p.id), 0)::int as avancement,
    case
      when p.date_debut is null or p.date_fin_prevue is null or p.date_fin_prevue <= p.date_debut then null
      when current_date <= p.date_debut then 0
      when current_date >= p.date_fin_prevue then 100
      else round((current_date - p.date_debut)::numeric / (p.date_fin_prevue - p.date_debut) * 100)
    end::int as avancement_attendu,
    coalesce((select sum(c.montant) from public.commandes c where c.projet_id = p.id and c.statut <> 'annulee'), 0) as engage,
    coalesce((select sum(f.montant) from public.factures f where f.projet_id = p.id), 0) as facture,
    coalesce((select sum(f.montant) from public.factures f where f.projet_id = p.id and f.statut = 'payee'), 0) as paye,
    (select count(*) from public.rapports r where r.projet_id = p.id and r.statut = 'soumis')::int as rapports_en_attente,
    (select max(r.date_rapport) from public.rapports r where r.projet_id = p.id) as dernier_rapport,
    (select count(*) from public.affectations a where a.projet_id = p.id)::int as equipe,
    (select rp.chemin from public.rapport_photos rp join public.rapports r on r.id = rp.rapport_id
      where r.projet_id = p.id order by rp.created_at desc limit 1) as photo_terrain
  from public.projets p
)
select
  b.*,
  case when b.statut <> 'termine' and b.date_fin_prevue < current_date
       then current_date - b.date_fin_prevue else 0 end as jours_de_retard,
  case
    when b.statut = 'termine' then 'termine'
    when (b.budget > 0 and greatest(b.engage, b.facture) > b.budget)
      or (b.avancement_attendu is not null and b.avancement_attendu - b.avancement > 15)
      or (b.date_fin_prevue < current_date)
      then 'critique'
    when (b.budget > 0 and greatest(b.engage, b.facture) > b.budget * 0.9)
      or (b.avancement_attendu is not null and b.avancement_attendu - b.avancement > 5)
      then 'attention'
    else 'ok'
  end as sante
from base b;
grant select on public.v_projets to authenticated;

-- ─── Annonces sponsorisées (gérées par le propriétaire de la plateforme) ───
create table if not exists public.annonces (
  id          uuid primary key default gen_random_uuid(),
  annonceur   text not null,
  titre       text not null,
  texte       text,
  lien        text,
  bouton      text default 'En savoir plus',
  image       text,                       -- fichier dans l'espace public « annonces »
  debut       date not null default current_date,
  fin         date,
  prix        numeric(16,2),
  actif       boolean not null default true,
  roles       text[],                     -- vide = tous les rôles
  impressions integer not null default 0,
  clics       integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.annonces enable row level security;
drop policy if exists annonces_lecture on public.annonces;
create policy annonces_lecture on public.annonces for select using (auth.uid() is not null);
drop policy if exists annonces_admin on public.annonces;
create policy annonces_admin on public.annonces for all
  using (public.est_admin_plateforme()) with check (public.est_admin_plateforme());
grant select, insert, update, delete on public.annonces to authenticated;

-- Compteurs d'affichages et de clics
create or replace function public.annonce_evenement(p_annonce uuid, p_type text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_type = 'vue' then update annonces set impressions = impressions + 1 where id = p_annonce;
  elsif p_type = 'clic' then update annonces set clics = clics + 1 where id = p_annonce;
  end if;
end $$;
revoke execute on function public.annonce_evenement(uuid, text) from public, anon;
grant execute on function public.annonce_evenement(uuid, text) to authenticated;

-- Images des annonces : espace public, alimenté uniquement par le propriétaire
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('annonces', 'annonces', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists annonces_images_gestion on storage.objects;
create policy annonces_images_gestion on storage.objects for all to authenticated
  using (bucket_id = 'annonces' and public.est_admin_plateforme())
  with check (bucket_id = 'annonces' and public.est_admin_plateforme());

-- ─── Communiqués internes ───
create table if not exists public.communiques (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id     uuid references public.projets(id) on delete cascade,   -- vide = toute l'entreprise
  titre         text not null check (length(trim(titre)) > 0),
  contenu       text,
  important     boolean not null default false,
  photo         text,                                                  -- chemin dans photos-chantier
  auteur_id     uuid default auth.uid() references public.profils(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists communiques_entreprise_idx on public.communiques (entreprise_id, created_at desc);
create index if not exists communiques_projet_idx on public.communiques (projet_id);

alter table public.communiques enable row level security;
drop policy if exists communiques_lecture on public.communiques;
create policy communiques_lecture on public.communiques for select
  using (entreprise_id = public.mon_entreprise() and (projet_id is null or public.voit_projet(projet_id)));
drop policy if exists communiques_gestion on public.communiques;
create policy communiques_gestion on public.communiques for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'));
grant select, insert, update, delete on public.communiques to authenticated;

drop trigger if exists licence_communiques on public.communiques;
create trigger licence_communiques before insert or update or delete on public.communiques
  for each row execute function public.verifier_licence();

-- Nouveau communiqué : il apparaît dans le flux d'activité (cloche)
create or replace function public.trg_communique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform ajouter_activite(new.entreprise_id, new.projet_id, 'communique',
    case when new.important then 'attention' else 'info' end,
    nom_utilisateur(auth.uid()) || ' a publié un communiqué : « ' || new.titre || ' »');
  return new;
end $$;
drop trigger if exists communique_cree on public.communiques;
create trigger communique_cree after insert on public.communiques
  for each row execute function public.trg_communique();

-- Photos : la Direction et la Coordination peuvent retirer une photo
-- de couverture ou de communiqué de leur entreprise.
drop policy if exists photos_chantier_suppression on storage.objects;
create policy photos_chantier_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'photos-chantier'
         and (storage.foldername(name))[1] = public.mon_entreprise()::text
         and public.a_role('direction','coordinateur'));

-- ═══════════════════════════════════════════════════════════════════
-- 12. KOORDIN 1.6 : GALERIE PHOTO DE CHAQUE PROJET
-- • Toutes les images d'un chantier au même endroit : les photos
--   ajoutées directement à la galerie et celles des rapports du terrain.
-- • Ajout : Direction, Coordination et Techniciens affectés.
-- • Suppression : Direction, Coordination, ou l'auteur de la photo.
-- Bloc ré-exécutable sans risque (sert aussi de mise à jour).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.projet_photos (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id     uuid not null references public.projets(id) on delete cascade,
  chemin        text not null,                -- fichier dans photos-chantier
  legende       text,
  auteur_id     uuid default auth.uid() references public.profils(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists projet_photos_projet_idx on public.projet_photos (projet_id, created_at desc);

alter table public.projet_photos enable row level security;
drop policy if exists projet_photos_lecture on public.projet_photos;
create policy projet_photos_lecture on public.projet_photos for select
  using (entreprise_id = public.mon_entreprise() and public.voit_projet(projet_id));
drop policy if exists projet_photos_ajout on public.projet_photos;
create policy projet_photos_ajout on public.projet_photos for insert
  with check (entreprise_id = public.mon_entreprise() and public.voit_projet(projet_id)
              and public.a_role('direction','coordinateur','technicien'));
drop policy if exists projet_photos_modif on public.projet_photos;
create policy projet_photos_modif on public.projet_photos for update
  using (entreprise_id = public.mon_entreprise() and (public.a_role('direction','coordinateur') or auteur_id = auth.uid()))
  with check (entreprise_id = public.mon_entreprise());
drop policy if exists projet_photos_suppression on public.projet_photos;
create policy projet_photos_suppression on public.projet_photos for delete
  using (entreprise_id = public.mon_entreprise() and (public.a_role('direction','coordinateur') or auteur_id = auth.uid()));
grant select, insert, update, delete on public.projet_photos to authenticated;

drop trigger if exists licence_projet_photos on public.projet_photos;
create trigger licence_projet_photos before insert or update or delete on public.projet_photos
  for each row execute function public.verifier_licence();

-- La galerie d'un projet : photos de la galerie + photos des rapports.
-- Tous ceux qui voient le projet voient toutes ses photos (y compris
-- celles des rapports des autres techniciens).
create or replace function public.galerie_projet(p_projet uuid)
returns table (id uuid, source text, chemin text, legende text, auteur text, auteur_id uuid, date_photo timestamptz, rapport_id uuid)
language sql stable security definer set search_path = public as $$
  select * from (
    select pp.id, 'galerie'::text, pp.chemin, pp.legende, nom_utilisateur(pp.auteur_id), pp.auteur_id, pp.created_at, null::uuid
    from projet_photos pp
    where pp.projet_id = p_projet and pp.entreprise_id = mon_entreprise()
    union all
    select rp.id, 'rapport'::text, rp.chemin, nullif(left(r.travaux, 160), ''), nom_utilisateur(r.auteur_id), r.auteur_id,
           greatest(r.date_rapport::timestamptz, date_trunc('day', rp.created_at)) , r.id
    from rapport_photos rp join rapports r on r.id = rp.rapport_id
    where r.projet_id = p_projet and r.entreprise_id = mon_entreprise()
  ) g
  where public.voit_projet(p_projet)
  order by 7 desc
$$;
revoke execute on function public.galerie_projet(uuid) from public, anon;
grant execute on function public.galerie_projet(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 13. KOORDIN 1.9 : POINTAGE ET PAIE DES OUVRIERS JOURNALIERS
-- • Le chef de chantier fait l'appel chaque jour (journée ou demi-journée).
-- • Un ouvrier ne peut être pointé que sur un seul chantier par jour.
-- • Le tarif du jour est figé au moment du pointage.
-- • La paie hebdomadaire est marquée « payée » par la Direction ou la
--   Comptabilité ; un pointage payé ne peut plus être modifié.
-- • Les montants ne sont visibles que par Direction, Coordination,
--   Comptabilité et le chef de chantier sur ses propres chantiers.
-- À coller dans Supabase → SQL Editor → New query, puis Run.
-- Sans risque si relancé.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.ouvriers (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  nom           text not null check (length(trim(nom)) > 0),
  telephone     text,
  metier        text,
  tarif_jour    numeric(12,2) not null default 0 check (tarif_jour >= 0),
  actif         boolean not null default true,
  cree_par      uuid default auth.uid() references public.profils(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists ouvriers_entreprise_idx on public.ouvriers (entreprise_id, nom);

create table if not exists public.pointages (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id     uuid not null references public.projets(id) on delete cascade,
  ouvrier_id    uuid not null references public.ouvriers(id) on delete cascade,
  date_pointage date not null default current_date,
  presence      numeric(3,1) not null default 1 check (presence in (0.5, 1)),
  tarif_jour    numeric(12,2),
  paye          boolean not null default false,
  paye_le       timestamptz,
  paye_par      uuid references public.profils(id) on delete set null,
  auteur_id     uuid default auth.uid() references public.profils(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (ouvrier_id, date_pointage)
);
create index if not exists pointages_projet_idx on public.pointages (projet_id, date_pointage);
create index if not exists pointages_date_idx on public.pointages (entreprise_id, date_pointage);

-- Contrôles : bon chantier, bonne entreprise, date autorisée, tarif figé, paie protégée
create or replace function public.controler_pointage() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.mon_role();
begin
  if tg_op = 'DELETE' then
    if old.paye then raise exception 'POINTAGE_PAYE' using hint = 'Ce pointage a déjà été payé : il ne peut plus être supprimé.'; end if;
    if r = 'technicien' and old.date_pointage < current_date - 2 then
      raise exception 'POINTAGE_ANCIEN' using hint = 'Un chef de chantier ne peut corriger que les 3 derniers jours.';
    end if;
    return old;
  end if;
  if not exists (select 1 from ouvriers o where o.id = new.ouvrier_id and o.entreprise_id = new.entreprise_id) then
    raise exception 'Ouvrier inconnu.';
  end if;
  if not exists (select 1 from projets p where p.id = new.projet_id and p.entreprise_id = new.entreprise_id) then
    raise exception 'Chantier inconnu.';
  end if;
  if new.date_pointage > current_date then
    raise exception 'POINTAGE_FUTUR' using hint = 'On ne peut pas pointer un jour qui n''est pas encore passé.';
  end if;
  if tg_op = 'INSERT' then
    if new.tarif_jour is null or r = 'technicien' then
      select tarif_jour into new.tarif_jour from ouvriers where id = new.ouvrier_id;
    end if;
    new.paye := false; new.paye_le := null; new.paye_par := null;
    new.auteur_id := auth.uid();
  else
    if old.paye and r <> 'direction' then
      raise exception 'POINTAGE_PAYE' using hint = 'Ce pointage a déjà été payé : il ne peut plus être modifié.';
    end if;
    if new.paye is distinct from old.paye then
      if not public.a_role('direction','comptable') then
        raise exception 'Seules la Direction et la Comptabilité peuvent marquer la paie.';
      end if;
      new.paye_le := case when new.paye then now() end;
      new.paye_par := case when new.paye then auth.uid() end;
    end if;
    if r = 'technicien' then new.tarif_jour := old.tarif_jour; end if;
    if r = 'comptable' and (new.presence, new.tarif_jour, new.date_pointage, new.projet_id, new.ouvrier_id)
         is distinct from (old.presence, old.tarif_jour, old.date_pointage, old.projet_id, old.ouvrier_id) then
      raise exception 'La Comptabilité marque la paie mais ne modifie pas les présences.';
    end if;
  end if;
  if r = 'technicien' and new.date_pointage < current_date - 2 then
    raise exception 'POINTAGE_ANCIEN' using hint = 'Un chef de chantier ne peut pointer que les 3 derniers jours.';
  end if;
  return new;
end $$;

drop trigger if exists controle_pointage on public.pointages;
create trigger controle_pointage before insert or update or delete on public.pointages
  for each row execute function public.controler_pointage();

-- Un chef de chantier ne modifie pas le tarif d'un ouvrier existant
create or replace function public.controler_ouvrier() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.mon_role() = 'technicien' and tg_op = 'UPDATE' and new.tarif_jour is distinct from old.tarif_jour then
    raise exception 'Seules la Direction et la Coordination peuvent changer le tarif d''un ouvrier.';
  end if;
  return new;
end $$;
drop trigger if exists controle_ouvrier on public.ouvriers;
create trigger controle_ouvrier before update on public.ouvriers
  for each row execute function public.controler_ouvrier();

alter table public.ouvriers enable row level security;
drop policy if exists ouvriers_lecture on public.ouvriers;
create policy ouvriers_lecture on public.ouvriers for select
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur','technicien','comptable'));
drop policy if exists ouvriers_ajout on public.ouvriers;
create policy ouvriers_ajout on public.ouvriers for insert
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur','technicien'));
drop policy if exists ouvriers_modif on public.ouvriers;
create policy ouvriers_modif on public.ouvriers for update
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur','technicien'))
  with check (entreprise_id = public.mon_entreprise());
drop policy if exists ouvriers_suppression on public.ouvriers;
create policy ouvriers_suppression on public.ouvriers for delete
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'));
grant select, insert, update, delete on public.ouvriers to authenticated;

alter table public.pointages enable row level security;
drop policy if exists pointages_lecture on public.pointages;
create policy pointages_lecture on public.pointages for select
  using (entreprise_id = public.mon_entreprise()
         and (public.a_role('direction','coordinateur','comptable')
              or (public.a_role('technicien') and public.voit_projet(projet_id))));
drop policy if exists pointages_ajout on public.pointages;
create policy pointages_ajout on public.pointages for insert
  with check (entreprise_id = public.mon_entreprise() and public.voit_projet(projet_id)
              and public.a_role('direction','coordinateur','technicien'));
drop policy if exists pointages_modif on public.pointages;
create policy pointages_modif on public.pointages for update
  using (entreprise_id = public.mon_entreprise()
         and (public.a_role('direction','coordinateur','comptable')
              or (public.a_role('technicien') and public.voit_projet(projet_id))))
  with check (entreprise_id = public.mon_entreprise() and public.voit_projet(projet_id));
drop policy if exists pointages_suppression on public.pointages;
create policy pointages_suppression on public.pointages for delete
  using (entreprise_id = public.mon_entreprise() and public.voit_projet(projet_id)
         and public.a_role('direction','coordinateur','technicien'));
grant select, insert, update, delete on public.pointages to authenticated;

do $$
declare t text;
begin
  foreach t in array array['ouvriers','pointages']
  loop
    execute format('drop trigger if exists licence_%1$s on public.%1$I', t);
    execute format('create trigger licence_%1$s before insert or update or delete on public.%1$I for each row execute function public.verifier_licence()', t);
  end loop;
end $$;

-- Ouvrier pointé ailleurs le même jour : on indique seulement le nom du chantier
-- (utile au chef de chantier, qui ne voit pas les autres chantiers).
create or replace function public.pointages_du_jour(p_date date)
returns table (ouvrier_id uuid, projet_id uuid, projet text)
language sql stable security definer set search_path = public as $$
  select pt.ouvrier_id, pt.projet_id, p.nom
  from pointages pt join projets p on p.id = pt.projet_id
  where pt.entreprise_id = mon_entreprise() and pt.date_pointage = p_date
    and public.a_role('direction','coordinateur','technicien','comptable')
$$;
revoke execute on function public.pointages_du_jour(date) from public, anon;
grant execute on function public.pointages_du_jour(date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 14. KOORDIN 2.0 : ACCÈS CLIENT (SUIVI DE CHANTIER EN LECTURE SEULE)
-- • La Direction ou la Coordination crée un lien secret par chantier.
-- • Le client ouvre le lien sans compte : avancement, planning,
--   rapports VALIDÉS et photos. Jamais de montants, ni d'incidents
--   internes, ni de noms d'ouvriers.
-- • Le lien peut être désactivé ou remplacé à tout moment.
-- À coller dans Supabase → SQL Editor → New query, puis Run.
-- Sans risque si relancé.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.liens_clients (
  id              uuid primary key default gen_random_uuid(),
  entreprise_id   uuid not null default public.mon_entreprise() references public.entreprises(id) on delete cascade,
  projet_id       uuid not null references public.projets(id) on delete cascade,
  jeton           text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  actif           boolean not null default true,
  visites         integer not null default 0,
  derniere_visite timestamptz,
  cree_par        uuid default auth.uid() references public.profils(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists liens_clients_projet_idx on public.liens_clients (projet_id);

-- Le jeton est toujours fabriqué par la base (jamais choisi par l'utilisateur)
create or replace function public.controler_lien_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.jeton := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    new.visites := 0; new.derniere_visite := null; new.cree_par := auth.uid();
    if not exists (select 1 from projets p where p.id = new.projet_id and p.entreprise_id = new.entreprise_id) then
      raise exception 'Chantier inconnu.';
    end if;
  else
    new.jeton := old.jeton; new.projet_id := old.projet_id; new.entreprise_id := old.entreprise_id;
    if coalesce(current_setting('koordin.visite', true), '') <> '1' then
      new.visites := old.visites; new.derniere_visite := old.derniere_visite;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists controle_lien_client on public.liens_clients;
create trigger controle_lien_client before insert or update on public.liens_clients
  for each row execute function public.controler_lien_client();

alter table public.liens_clients enable row level security;
drop policy if exists liens_clients_gestion on public.liens_clients;
create policy liens_clients_gestion on public.liens_clients for all
  using (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'))
  with check (entreprise_id = public.mon_entreprise() and public.a_role('direction','coordinateur'));
grant select, insert, update, delete on public.liens_clients to authenticated;

drop trigger if exists licence_liens_clients on public.liens_clients;
create trigger licence_liens_clients before insert or update or delete on public.liens_clients
  for each row execute function public.verifier_licence();

-- Ce que voit le client (et uniquement cela)
create or replace function public.suivi_client(p_jeton text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  l liens_clients;
  pr record;
  v_av int;
  v_att int;
  res jsonb;
begin
  if length(coalesce(p_jeton, '')) < 32 then return null; end if;
  select * into l from liens_clients where jeton = p_jeton and actif;
  if not found then return null; end if;
  perform set_config('koordin.visite', '1', true);
  update liens_clients set visites = visites + 1, derniere_visite = now() where id = l.id;
  perform set_config('koordin.visite', '', true);

  select p.*, e.nom as entreprise into pr
    from projets p join entreprises e on e.id = p.entreprise_id
   where p.id = l.projet_id;

  select coalesce(case when sum(lo.budget) > 0 then round(sum(lo.avancement * lo.budget) / sum(lo.budget))
                       else round(avg(lo.avancement)) end, 0)::int
    into v_av from lots lo where lo.projet_id = l.projet_id;
  v_att := case
    when pr.date_debut is null or pr.date_fin_prevue is null or pr.date_fin_prevue <= pr.date_debut then null
    when current_date <= pr.date_debut then 0
    when current_date >= pr.date_fin_prevue then 100
    else round((current_date - pr.date_debut)::numeric / (pr.date_fin_prevue - pr.date_debut) * 100) end;

  select jsonb_build_object(
    'entreprise', pr.entreprise,
    'projet', jsonb_build_object('nom', pr.nom, 'reference', pr.reference, 'client', pr.client, 'localisation', pr.localisation,
               'description', pr.description, 'statut', pr.statut, 'date_debut', pr.date_debut,
               'date_fin_prevue', pr.date_fin_prevue, 'date_fin_reelle', pr.date_fin_reelle,
               'photo', coalesce(pr.photo, (select rp.chemin from rapport_photos rp join rapports r on r.id = rp.rapport_id
                                             where r.projet_id = l.projet_id and r.statut = 'valide' order by rp.created_at desc limit 1)),
               'avancement', v_av, 'avancement_attendu', v_att,
               'jours_de_retard', case when pr.statut <> 'termine' and pr.date_fin_prevue < current_date
                                       then current_date - pr.date_fin_prevue else 0 end),
    'lots', coalesce((select jsonb_agg(jsonb_build_object('nom', lo.nom, 'avancement', lo.avancement) order by lo.ordre, lo.nom)
                        from lots lo where lo.projet_id = l.projet_id), '[]'::jsonb),
    'taches', coalesce((select jsonb_agg(jsonb_build_object('nom', t.nom, 'lot', lo.nom, 'date_debut', t.date_debut, 'date_fin', t.date_fin, 'avancement', t.avancement) order by t.date_debut, t.nom)
                          from taches t left join lots lo on lo.id = t.lot_id where t.projet_id = l.projet_id), '[]'::jsonb),
    'rapports', coalesce((select jsonb_agg(s.x order by s.d desc, s.c desc) from (
                            select r.date_rapport d, r.created_at c,
                                   jsonb_build_object('date', r.date_rapport, 'lot', lo.nom, 'meteo', r.meteo, 'travaux', r.travaux,
                                     'photos', coalesce((select jsonb_agg(rp.chemin order by rp.created_at) from rapport_photos rp where rp.rapport_id = r.id), '[]'::jsonb)) x
                              from rapports r left join lots lo on lo.id = r.lot_id
                             where r.projet_id = l.projet_id and r.statut = 'valide'
                             order by r.date_rapport desc, r.created_at desc limit 30) s), '[]'::jsonb),
    'galerie', coalesce((select jsonb_agg(jsonb_build_object('chemin', pp.chemin, 'legende', pp.legende, 'date', pp.created_at) order by pp.created_at desc)
                           from (select * from projet_photos where projet_id = l.projet_id order by created_at desc limit 24) pp), '[]'::jsonb),
    'maj', now()
  ) into res;
  return res;
end $$;

revoke execute on function public.suivi_client(text) from public;
grant execute on function public.suivi_client(text) to anon, authenticated;

-- Photos : un visiteur sans compte peut ouvrir les photos d'un chantier
-- qui a un lien client actif (rapports validés, galerie, couverture).
create or replace function public.photo_suivi_publique(p_chemin text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rapport_photos rp join rapports r on r.id = rp.rapport_id
                   join liens_clients l on l.projet_id = r.projet_id and l.actif
                  where rp.chemin = p_chemin and r.statut = 'valide')
      or exists (select 1 from projet_photos pp join liens_clients l on l.projet_id = pp.projet_id and l.actif
                  where pp.chemin = p_chemin)
      or exists (select 1 from projets p join liens_clients l on l.projet_id = p.id and l.actif
                  where p.photo = p_chemin)
$$;
revoke execute on function public.photo_suivi_publique(text) from public;
grant execute on function public.photo_suivi_publique(text) to anon;

drop policy if exists photos_suivi_client on storage.objects;
create policy photos_suivi_client on storage.objects for select to anon
  using (bucket_id = 'photos-chantier' and public.photo_suivi_publique(name));

-- ═══════════════════════════════════════════════════════════════════
-- 15. KOORDIN 2.1 : PARRAINAGE ENTRE ENTREPRISES
-- • Chaque entreprise a un code de parrainage (ex. GEC4K9) et un lien.
-- • L'entreprise filleule qui s'inscrit avec ce code reçoit un essai
--   de 30 jours au lieu de 14.
-- • Le parrain reçoit 1 mois offert quand la filleule paie son premier
--   abonnement (paiement validé par le propriétaire de KOORDIN).
--   Une seule récompense par filleule : pas de triche avec de faux comptes.
-- • Durées réglables : parametres_plateforme
--   « parrainage_essai_jours » (30) et « parrainage_mois_offerts » (1).
-- À coller dans Supabase → SQL Editor → New query, puis Run.
-- Sans risque si relancé.
-- ═══════════════════════════════════════════════════════════════════

alter table public.entreprises add column if not exists code_parrainage text;
alter table public.entreprises add column if not exists parrain_id uuid references public.entreprises(id) on delete set null;
alter table public.entreprises add column if not exists parrainage_recompense_le timestamptz;
create unique index if not exists entreprises_code_parrainage_idx on public.entreprises (code_parrainage);

insert into public.parametres_plateforme (cle, valeur) values
  ('parrainage_essai_jours', '30'), ('parrainage_mois_offerts', '1')
on conflict (cle) do nothing;

-- Code lisible : 3 lettres du nom + 3 caractères au hasard (sans 0/O/1/I)
create or replace function public.nouveau_code_parrainage(p_nom text) returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  prefixe text := upper(left(regexp_replace(translate(coalesce(p_nom, ''),
    'àâäáãçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaceeeeiiiinooooouuuuyyAAAAACEEEEIIIINOOOOOUUUUY'), '[^A-Za-z]', '', 'g'), 3));
  code text;
begin
  prefixe := rpad(prefixe, 3, 'K');
  loop
    code := prefixe || (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') from generate_series(1, 3));
    exit when not exists (select 1 from entreprises where code_parrainage = code);
  end loop;
  return code;
end $$;

create or replace function public.attribuer_code_parrainage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.code_parrainage := public.nouveau_code_parrainage(new.nom);
    new.parrain_id := null;
    new.parrainage_recompense_le := null;
  elsif auth.uid() is not null and not public.est_admin_plateforme() then
    -- Une entreprise ne modifie ni son code, ni son parrain, ni sa récompense
    new.code_parrainage := old.code_parrainage;
    new.parrain_id := old.parrain_id;
    new.parrainage_recompense_le := old.parrainage_recompense_le;
  end if;
  return new;
end $$;
drop trigger if exists code_parrainage on public.entreprises;
create trigger code_parrainage before insert or update on public.entreprises
  for each row execute function public.attribuer_code_parrainage();

update public.entreprises set code_parrainage = public.nouveau_code_parrainage(nom) where code_parrainage is null;

-- À l'inscription : rattacher la filleule à son parrain et allonger l'essai.
-- (Déclencheur nommé pour passer APRÈS koordin_nouvel_utilisateur.)
create or replace function public.appliquer_parrainage() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  code text := upper(trim(coalesce(new.raw_user_meta_data->>'parrain', '')));
  filleule entreprises;
  parrain uuid;
  jours int;
begin
  if code = '' then return new; end if;
  select e.* into filleule from profils p join entreprises e on e.id = p.entreprise_id
   where p.id = new.id and p.role = 'direction' and e.parrain_id is null
     and e.created_at > now() - interval '10 minutes';
  if not found then return new; end if;
  select id into parrain from entreprises where code_parrainage = code and id <> filleule.id;
  if parrain is null then return new; end if;
  jours := coalesce((select nullif(valeur, '')::int from parametres_plateforme where cle = 'parrainage_essai_jours'), 30);
  update entreprises
     set parrain_id = parrain,
         licence_fin = greatest(licence_fin, created_at + make_interval(days => jours))
   where id = filleule.id;
  insert into activites (entreprise_id, type, niveau, message, roles)
  values (parrain, 'equipe', 'info',
          '🎁 ' || filleule.nom || ' s''est inscrite avec votre code de parrainage. Vous gagnerez un mois offert dès son premier abonnement.',
          array['direction']);
  return new;
end $$;
drop trigger if exists koordin_parrainage on auth.users;
create trigger koordin_parrainage after insert on auth.users
  for each row execute function public.appliquer_parrainage();

-- Code valide ? (écran d'inscription, sans compte)
create or replace function public.verifier_code_parrainage(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select nom from entreprises where code_parrainage = upper(trim(p_code)) and length(trim(p_code)) between 4 and 12
$$;
revoke execute on function public.verifier_code_parrainage(text) from public;
grant execute on function public.verifier_code_parrainage(text) to anon, authenticated;

-- Tableau de bord du parrain (Direction)
create or replace function public.mon_parrainage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e entreprises;
begin
  if not public.a_role('direction') then raise exception 'Réservé à la Direction.'; end if;
  select * into e from entreprises where id = public.mon_entreprise();
  return jsonb_build_object(
    'code', e.code_parrainage,
    'essai_jours', coalesce((select nullif(valeur, '')::int from parametres_plateforme where cle = 'parrainage_essai_jours'), 30),
    'mois_offerts', coalesce((select nullif(valeur, '')::int from parametres_plateforme where cle = 'parrainage_mois_offerts'), 1),
    'filleules', coalesce((select jsonb_agg(jsonb_build_object('nom', f.nom, 'inscrite_le', f.created_at,
                    'abonnee', f.parrainage_recompense_le is not null, 'recompense_le', f.parrainage_recompense_le) order by f.created_at desc)
                  from entreprises f where f.parrain_id = e.id), '[]'::jsonb)
  );
end $$;
revoke execute on function public.mon_parrainage() from public, anon;
grant execute on function public.mon_parrainage() to authenticated;

-- Paiement validé : prolonger la licence, puis récompenser le parrain (une seule fois)
create or replace function public.traiter_paiement(p_paiement uuid, p_valider boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare pa paiements; f entreprises; mois int;
begin
  if not public.est_admin_plateforme() then raise exception 'Réservé au propriétaire de KOORDIN'; end if;
  select * into pa from paiements where id = p_paiement and statut = 'declare' for update;
  if not found then raise exception 'Paiement introuvable ou déjà traité'; end if;
  update paiements set statut = case when p_valider then 'valide' else 'refuse' end,
                       note = coalesce(p_note, note), traite_par = auth.uid(), traite_at = now()
   where id = p_paiement;
  if p_valider then
    perform public.prolonger_licence(pa.entreprise_id, pa.plan,
      case pa.periode when 'mois' then 1 when 'trimestre' then 3 else 12 end);
    insert into activites (entreprise_id, type, niveau, message, roles, acteur_id)
    values (pa.entreprise_id, 'equipe', 'info', 'Paiement validé : votre licence KOORDIN est prolongée.', array['direction'], auth.uid());
    -- Parrainage
    select * into f from entreprises where id = pa.entreprise_id for update;
    if f.parrain_id is not null and f.parrainage_recompense_le is null and pa.montant > 0 then
      mois := coalesce((select nullif(valeur, '')::int from parametres_plateforme where cle = 'parrainage_mois_offerts'), 1);
      update entreprises set parrainage_recompense_le = now() where id = f.id;
      update entreprises set licence_fin = greatest(licence_fin, now()) + make_interval(months => mois) where id = f.parrain_id;
      insert into activites (entreprise_id, type, niveau, message, roles, acteur_id)
      values (f.parrain_id, 'equipe', 'info',
              '🎁 Merci ! ' || f.nom || ' vient de s''abonner grâce à vous : ' || mois || ' mois offert' || case when mois > 1 then 's' else '' end || ' sur votre licence KOORDIN.',
              array['direction'], auth.uid());
    end if;
  else
    insert into activites (entreprise_id, type, niveau, message, roles, acteur_id)
    values (pa.entreprise_id, 'alerte', 'attention', 'Paiement non validé' || coalesce(' : ' || p_note, '') || '. Contactez KOORDIN.', array['direction'], auth.uid());
  end if;
end $$;
grant execute on function public.traiter_paiement(uuid, boolean, text) to authenticated;
