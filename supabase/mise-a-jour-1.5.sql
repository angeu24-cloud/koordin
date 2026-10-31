-- KOORDIN 1.5 — mise à jour de la base de données
-- À coller dans Supabase → SQL Editor → New query, puis Run. Sans risque si relancé.

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
