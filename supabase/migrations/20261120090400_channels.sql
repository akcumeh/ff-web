create table public.channel_posts (
  id           uuid primary key default gen_random_uuid(),
  suit_id      uuid not null references public.suits (id) on delete cascade,
  platform     public.post_platform not null,
  caption      text not null check (char_length(caption) <= 1024),
  status       public.post_status not null default 'pending',
  external_id  text,
  error        text check (char_length(error) <= 300),
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (suit_id, platform),
  constraint channel_posts_posted_has_time check (status <> 'posted' or posted_at is not null)
);

create index channel_posts_platform_status_idx on public.channel_posts (platform, status);

create table public.channel_snapshots (
  id          bigint generated always as identity primary key,
  platform    text not null check (platform in ('telegram', 'whatsapp')),
  taken_on    date not null,
  followers   integer not null check (followers >= 0),
  source      text not null check (source in ('api', 'manual')),
  created_at  timestamptz not null default now(),
  unique (platform, taken_on)
);
