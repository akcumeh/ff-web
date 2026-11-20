create table public.rate_limits (
  key           text not null check (char_length(key) <= 200),
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (key, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

create function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language sql
set search_path = ''
as $$
  insert into public.rate_limits as r (key, window_start, count)
  values (
    p_key,
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds),
    1
  )
  on conflict (key, window_start) do update set count = r.count + 1
  returning count <= p_max;
$$;
