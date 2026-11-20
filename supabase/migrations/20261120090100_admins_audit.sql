create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique check (email = lower(email)),
  role        text not null default 'owner' check (role = 'owner'),
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id           bigint generated always as identity primary key,
  admin_id     uuid references public.admins (user_id) on delete set null,
  action       text not null check (char_length(action) <= 40),
  target_type  text check (char_length(target_type) <= 40),
  target_id    text check (char_length(target_id) <= 80),
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);
