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
