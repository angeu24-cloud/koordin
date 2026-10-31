-- KOORDIN 1.6 — mise à jour de la base de données (galerie photo des projets)
-- À coller dans Supabase → SQL Editor → New query, puis Run. Sans risque si relancé.
-- Nécessite que la mise à jour 1.5 ait déjà été faite.

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
