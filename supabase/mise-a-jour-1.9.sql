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
