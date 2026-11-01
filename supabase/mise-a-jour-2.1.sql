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
