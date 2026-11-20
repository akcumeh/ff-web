create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text not null unique check (ref ~ '^FF-[A-HJ-NP-Z2-9]{8}$'),
  suit_id             uuid not null references public.suits (id) on delete restrict,
  variant_id          uuid not null references public.suit_variants (id) on delete restrict,
  qty                 smallint not null check (qty between 1 and 10),
  amount_kobo         bigint not null check (amount_kobo > 0),
  currency            text not null default 'NGN' check (currency = 'NGN'),
  status              public.order_status not null default 'pending',
  paystack_reference  text unique check (paystack_reference is null or paystack_reference = ref),
  customer_name       text not null check (char_length(customer_name) between 2 and 80),
  phone               text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  email               text not null check (char_length(email) <= 254 and position('@' in email) > 1),
  delivery_address    text not null check (char_length(delivery_address) between 10 and 300),
  notes               text check (char_length(notes) <= 500),
  visitor_id          uuid references public.visitors (id) on delete set null,
  paid_at             timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint orders_paid_has_time check (status not in ('paid', 'delivered') or paid_at is not null),
  constraint orders_delivered_has_time check (status <> 'delivered' or delivered_at is not null)
);

create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_suit_idx on public.orders (suit_id);
create index orders_variant_idx on public.orders (variant_id);

create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.payment_events (
  id                 bigint generated always as identity primary key,
  provider_event_id  text not null unique,
  event_type         text not null,
  payload            jsonb not null,
  order_id           uuid references public.orders (id) on delete set null,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz
);

create index payment_events_order_idx on public.payment_events (order_id);
