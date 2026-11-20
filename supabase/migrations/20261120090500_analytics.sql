create table public.visitors (
  id               uuid primary key default gen_random_uuid(),
  cookie_hash      text not null unique,
  fp_hash          text,
  consent_at       timestamptz not null,
  consent_version  text not null check (char_length(consent_version) <= 20),
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now()
);

create index visitors_fp_hash_idx on public.visitors (fp_hash) where fp_hash is not null;
create index visitors_last_seen_idx on public.visitors (last_seen);

create table public.events (
  id          bigint generated always as identity primary key,
  visitor_id  uuid not null references public.visitors (id) on delete cascade,
  type        public.event_type not null,
  suit_id     uuid references public.suits (id) on delete set null,
  source      text check (source in ('direct', 'wa', 'tg', 'search', 'other')),
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index events_type_created_idx on public.events (type, created_at);
create index events_suit_created_idx on public.events (suit_id, created_at);
create index events_created_idx on public.events (created_at);
create unique index events_one_view_per_day_idx on public.events
  (visitor_id, suit_id, type, ((created_at at time zone 'Africa/Lagos')::date))
  where type = 'suit_view';

create table public.daily_counts (
  day                date not null,
  suit_id            uuid references public.suits (id) on delete cascade,
  metric             public.event_type not null,
  source             text not null default 'other' check (source in ('direct', 'wa', 'tg', 'search', 'other')),
  anon_count         integer not null default 0 check (anon_count >= 0),
  consented_count    integer not null default 0 check (consented_count >= 0),
  consented_uniques  integer not null default 0 check (consented_uniques >= 0),
  constraint daily_counts_key unique nulls not distinct (day, suit_id, metric, source)
);

create function public.count_anon_event(p_suit_id uuid, p_metric public.event_type, p_source text)
returns void
language sql
set search_path = ''
as $$
  insert into public.daily_counts as d (day, suit_id, metric, source, anon_count)
  select (now() at time zone 'Africa/Lagos')::date, s.suit_id, p_metric, coalesce(p_source, 'other'), 1
  from (select distinct v.suit_id from (values (p_suit_id), (null::uuid)) as v (suit_id)) as s
  on conflict on constraint daily_counts_key
  do update set anon_count = d.anon_count + 1;
$$;

create table public.enquiries (
  id               uuid primary key default gen_random_uuid(),
  code             text not null check (code ~ '^[A-HJ-NP-Z2-9]{4}$'),
  suit_id          uuid not null references public.suits (id) on delete cascade,
  created_at       timestamptz not null default now(),
  chat_started_at  timestamptz,
  chat_started_by  uuid references public.admins (user_id) on delete set null,
  unique (code, suit_id)
);

create index enquiries_created_idx on public.enquiries (created_at desc);
