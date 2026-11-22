create function public.rollup_day(p_day date)
returns integer
language sql
set search_path = ''
as $$
  with ev as (
    select e.suit_id, e.type as metric, coalesce(e.source, 'other') as source, e.visitor_id
    from public.events e
    where e.created_at >= (p_day::timestamp at time zone 'Africa/Lagos')
      and e.created_at < ((p_day + 1)::timestamp at time zone 'Africa/Lagos')
  ),
  agg as (
    select suit_id, metric, source, count(*)::int as c, count(distinct visitor_id)::int as u
    from ev where suit_id is not null
    group by suit_id, metric, source
    union all
    select null::uuid, metric, source, count(*)::int, count(distinct visitor_id)::int
    from ev
    group by metric, source
  ),
  up as (
    insert into public.daily_counts as d (day, suit_id, metric, source, consented_count, consented_uniques)
    select p_day, suit_id, metric, source, c, u from agg
    on conflict on constraint daily_counts_key
    do update set consented_count = excluded.consented_count, consented_uniques = excluded.consented_uniques
    returning 1
  )
  select count(*)::int from up;
$$;

create function public.approx_uniques(p_from timestamptz, p_to timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(distinct visitor_id)::int
  from public.events
  where type = 'suit_view' and created_at >= p_from and created_at < p_to;
$$;

revoke execute on function public.rollup_day(date) from public, anon, authenticated;
revoke execute on function public.approx_uniques(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.rollup_day(date) to service_role;
grant execute on function public.approx_uniques(timestamptz, timestamptz) to service_role;
