alter table public.suits
  add column suit_type     text check (suit_type in ('skirt-suit', 'gown-suit')),
  add column skirt_length  text check (skirt_length in ('knee', '3/4', 'full')),
  add column gown_length   text check (gown_length in ('3/4', 'full')),
  add column sleeve_length text check (sleeve_length in ('3/4', 'full')),
  add column has_camisole  boolean,
  add column has_belt      boolean,
  add column has_no_jacket boolean;
