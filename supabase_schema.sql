-- ═══════════════════════════════════════════════════════════════
--  Vote pondéré — schéma Supabase
--  À exécuter dans : Supabase > SQL Editor > New query > Run
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────── TABLES ─────────────
create table if not exists public.settings (
  id             int primary key default 1 check (id = 1),   -- ligne unique
  election_open  boolean not null default false,
  live_enabled   boolean not null default false,
  max_votes      int     not null default 20 check (max_votes >= 1)
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.candidates (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  genre     text check (genre in ('H','F')),
  poste     text,
  medecin   boolean not null default false,
  position  serial
);

create table if not exists public.voters (
  id        uuid primary key default gen_random_uuid(),
  club      text not null,
  voices    int  not null default 1 check (voices >= 1),
  delegate  text,
  email     text
);

create table if not exists public.links (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  label       text,
  multiplier  int  not null default 1 check (multiplier >= 1),   -- nombre de tours = nombre de voix
  voter_id    uuid references public.voters(id) on delete cascade,
  tours_done  int  not null default 0,
  used        boolean not null default false,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Votes anonymes : aucune référence au lien ni au votant
create table if not exists public.votes (
  id            bigserial primary key,
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  weight        int  not null default 1,
  created_at    timestamptz not null default now()
);

-- ───────────── SÉCURITÉ (RLS) ─────────────
alter table public.settings   enable row level security;
alter table public.candidates enable row level security;
alter table public.voters     enable row level security;
alter table public.links      enable row level security;
alter table public.votes      enable row level security;

-- Admin = utilisateur authentifié Supabase Auth (créer 1 utilisateur : Authentication > Users)
create policy "admin all settings"   on public.settings   for all to authenticated using (true) with check (true);
create policy "admin all candidates" on public.candidates for all to authenticated using (true) with check (true);
create policy "admin all voters"     on public.voters     for all to authenticated using (true) with check (true);
create policy "admin all links"      on public.links      for all to authenticated using (true) with check (true);
create policy "admin all votes"      on public.votes      for all to authenticated using (true) with check (true);

-- Public (clé anon) : lecture des candidats et des réglages uniquement
create policy "public read candidates" on public.candidates for select to anon using (true);
create policy "public read settings"   on public.settings   for select to anon using (true);
-- Aucun accès direct anon à voters / links / votes : tout passe par les fonctions ci-dessous.

-- ───────────── FONCTIONS (RPC) ─────────────

-- Infos d'un lien pour la page votant
create or replace function public.get_link_status(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare l public.links; s public.settings;
begin
  select * into s from settings where id = 1;
  select * into l from links where token = p_token;
  if not found then return json_build_object('status','invalid'); end if;
  if l.used then return json_build_object('status','used'); end if;
  if not s.election_open then return json_build_object('status','closed'); end if;
  return json_build_object('status','ok','tours_total',l.multiplier,
                           'tours_done',l.tours_done,'max_votes',s.max_votes);
end $$;

-- Enregistre UN tour de vote (atomique, anti double vote)
create or replace function public.submit_tour(p_token text, p_candidate_ids uuid[])
returns json language plpgsql security definer set search_path = public as $$
declare l public.links; s public.settings; n int; valid int;
begin
  select * into s from settings where id = 1;
  select * into l from links where token = p_token for update;   -- verrou de ligne
  if not found           then raise exception 'lien invalide'; end if;
  if l.used              then raise exception 'lien déjà utilisé'; end if;
  if not s.election_open then raise exception 'élection fermée'; end if;

  p_candidate_ids := (select array_agg(distinct x) from unnest(p_candidate_ids) x);
  n := coalesce(array_length(p_candidate_ids, 1), 0);
  if n = 0 or n > s.max_votes then raise exception 'nombre de choix invalide'; end if;

  select count(*) into valid from candidates where id = any(p_candidate_ids);
  if valid <> n then raise exception 'candidat inconnu'; end if;

  insert into votes (candidate_id, weight)
    select unnest(p_candidate_ids), 1;

  update links
     set tours_done = tours_done + 1,
         used       = (tours_done + 1 >= multiplier),
         used_at    = case when tours_done + 1 >= multiplier then now() end
   where id = l.id
   returning * into l;

  return json_build_object('tours_done',l.tours_done,'tours_total',l.multiplier,'used',l.used);
end $$;

-- Résultats : publics seulement si la page live est activée, sinon admin uniquement
create or replace function public.get_results()
returns table (candidate_id uuid, name text, points bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not (select live_enabled from settings where id = 1)
     and auth.role() <> 'authenticated' then
    raise exception 'page live désactivée';
  end if;
  return query
    select c.id, c.name, coalesce(sum(v.weight),0)::bigint
      from candidates c left join votes v on v.candidate_id = c.id
     group by c.id, c.name, c.position
     order by 3 desc, c.position;
end $$;

grant execute on function public.get_link_status(text)       to anon, authenticated;
grant execute on function public.submit_tour(text, uuid[])   to anon, authenticated;
grant execute on function public.get_results()               to anon, authenticated;

-- Temps réel (admin) : écouter les changements
alter publication supabase_realtime add table public.votes, public.links, public.settings;

-- ───────────── DONNÉES INITIALES (fichier Excel) ─────────────
insert into public.voters (club, voices, delegate, email) values
 ('AS St Maurice',2,'Rudy Simouni','rudy.simouni@gmail.com'),
 ('ASPO',6,'Freddy Atlani','freddy.atlani@free.fr'),
 ('Jacques Nadjar - Membre individuel',1,'Jacques Nadjar','jacques.nadjar@wanadoo.fr'),
 ('Maccabi Cannes',1,'Norbert Benazerah','n.benz2323@gmail.com'),
 ('Maccabi Creteil',2,'Gilles Cohen','gillescohen57@yahoo.fr'),
 ('Maccabi Lyon',1,'Aurelien Meslati','mes.aurelien@gmail.com'),
 ('Maccabi Marseille',1,'Sidney Mimoun','cabinet.mimoun@orange.fr'),
 ('Maccabi Massy',2,'Gabriel Slakmon','maccabimassy@gmail.com'),
 ('Maccabi Nice',1,'Frank Journo','njourno@free.fr'),
 ('Maccabi Pantin',1,'Yohan Assous','yohann.assous@gmail.com'),
 ('Maccabi Paris',2,'Jean Jacques Benguigui','563601@lpiff.fr'),
 ('Maccabi Sarcelles',13,'Pierre Haddad','pierreh8@hotmail.com'),
 ('Maccabi Thiais',1,'Jordan Azria','jordan-94210@hotmail.fr'),
 ('Maccabi Versailles',4,'Fabrice Madar','docteur.f.madar@orange.fr');

insert into public.candidates (name, genre, poste, medecin) values
 ('Pierre Haddad','H','Comité Directeur',false),('Aymerick Benchimol','H','Comité Directeur',false),
 ('Freddy Atlani','H','Comité Directeur',true), ('Fabrice Madar','H','Comité Directeur',false),
 ('Charly Elmaleh','H','Comité Directeur',false),('Rudy Simouni','H','Comité Directeur',false),
 ('Sidney Mimoun','H','Comité Directeur',false),('David Malher','H','Comité Directeur',false),
 ('Norbert Benazerah','H','Comité Directeur',false),('Jacques Nadjar','H','Comité Directeur',false),
 ('Fabrice Hanoufa','H','Comité Directeur',false),('Corinne Levitt','F','Comité Directeur',false),
 ('Naomi Castro','F','Comité Directeur',false),('Caroline Levy','F','Comité Directeur',false),
 ('Valerie Cohen','F','Comité Directeur',false),('Vanessa Assous','F','Comité Directeur',false),
 ('Johanna Touitou','F','Comité Directeur',false),('Dynah Tubiana','F','Comité Directeur',false),
 ('Kerene Naccache','F','Comité Directeur',false),('Carly Benitah','F','Comité Directeur',false),
 ('Iris Srour','F','Comité Directeur',false);

-- Un lien par votant (multiplier = nombre de voix)
insert into public.links (label, multiplier, voter_id)
  select club || ' — ' || delegate, voices, id from public.voters;
