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
create policy projets_lecture on public.projets for select using (public.voit_projet(id));
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
