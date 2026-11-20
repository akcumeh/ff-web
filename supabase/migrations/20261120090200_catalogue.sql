create table public.batches (
  id          uuid primary key default gen_random_uuid(),
  label       text not null check (char_length(label) between 1 and 80),
  arrived_on  date not null,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now()
);

create sequence public.suit_ref_london_seq;
create sequence public.suit_ref_turkey_seq;

create table public.suits (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,
  slug          text not null unique,
  style         public.suit_style not null,
  title         text not null check (char_length(title) between 3 and 80),
  description   text check (char_length(description) <= 600),
  price_kobo    integer not null check (price_kobo between 1 and 500000000),
  status        public.suit_status not null default 'draft',
  batch_id      uuid not null references public.batches (id) on delete restrict,
  published_at  timestamptz,
  created_by    uuid references public.admins (user_id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create function public.suits_assign_ref()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.style = 'london' then
      new.ref := 'LN-' || lpad(nextval('public.suit_ref_london_seq')::text, 2, '0');
    else
      new.ref := 'TR-' || lpad(nextval('public.suit_ref_turkey_seq')::text, 2, '0');
    end if;
    new.slug := new.style::text || '-style-' || lower(new.ref);
  elsif new.ref <> old.ref or new.slug <> old.slug or new.style <> old.style then
    raise exception 'ref, slug and style cannot change after a suit is created';
  end if;
  return new;
end;
$$;

create trigger suits_assign_ref before insert or update on public.suits
  for each row execute function public.suits_assign_ref();
create trigger suits_set_updated_at before update on public.suits
  for each row execute function public.set_updated_at();

create index suits_status_published_idx on public.suits (status, published_at desc);
create index suits_batch_idx on public.suits (batch_id);
create index suits_style_status_idx on public.suits (style, status);

create table public.suit_variants (
  id          uuid primary key default gen_random_uuid(),
  suit_id     uuid not null references public.suits (id) on delete cascade,
  colour      text not null check (char_length(colour) between 1 and 30),
  colour_hex  text check (colour_hex ~ '^#[0-9a-fA-F]{6}$'),
  size        text not null check (char_length(size) between 1 and 10),
  in_stock    boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (suit_id, colour, size)
);

create table public.suit_images (
  id             uuid primary key default gen_random_uuid(),
  suit_id        uuid not null references public.suits (id) on delete cascade,
  kind           public.image_kind not null,
  bucket         text not null check (bucket in ('originals', 'candidates', 'public-suits')),
  storage_path   text not null,
  widths         integer[] not null default '{}',
  width          integer check (width > 0),
  height         integer check (height > 0),
  blur_data      text check (char_length(blur_data) <= 2000),
  alt_text       text check (char_length(alt_text) <= 125),
  is_cover       boolean not null default false,
  sort           integer not null default 0,
  generation_id  uuid,
  created_at     timestamptz not null default now(),
  unique (bucket, storage_path)
);

create index suit_images_suit_kind_idx on public.suit_images (suit_id, kind);
create unique index suit_images_one_cover_idx on public.suit_images (suit_id) where is_cover;
