create type public.suit_style as enum ('london', 'turkey');
create type public.suit_status as enum ('draft', 'review', 'published', 'archived');
create type public.image_kind as enum ('original', 'candidate', 'final', 'detail');
create type public.gen_kind as enum ('catalogue', 'tryon');
create type public.gen_status as enum (
  'queued', 'running', 'succeeded', 'failed', 'failed_safety', 'blocked_budget', 'cancelled'
);
create type public.post_platform as enum ('telegram', 'whatsapp_pack');
create type public.post_status as enum ('pending', 'posted', 'failed');
create type public.order_status as enum ('pending', 'paid', 'failed', 'delivered', 'cancelled');
create type public.event_type as enum (
  'suit_view', 'enquire_click', 'checkout_start',
  'payment_success', 'delivery_click', 'join_channel_click'
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
