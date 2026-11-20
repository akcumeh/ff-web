create table public.ai_generations (
  id               uuid primary key default gen_random_uuid(),
  kind             public.gen_kind not null,
  suit_id          uuid references public.suits (id) on delete set null,
  status           public.gen_status not null default 'queued',
  redo_of          uuid references public.ai_generations (id) on delete set null,
  observe_model    text,
  draw_model       text,
  prompt_name      text,
  prompt_version   integer,
  observation      jsonb,
  final_prompt     text,
  candidate_count  smallint not null default 2 check (candidate_count between 1 and 2),
  input_tokens     integer not null default 0 check (input_tokens >= 0),
  output_tokens    integer not null default 0 check (output_tokens >= 0),
  image_count      smallint not null default 0 check (image_count >= 0),
  cost_usd_micro   bigint not null default 0 check (cost_usd_micro >= 0),
  requester_hash   text,
  error            text check (char_length(error) <= 300),
  started_at       timestamptz,
  finished_at      timestamptz,
  created_by       uuid references public.admins (user_id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint ai_generations_no_tryon_prompt check (kind = 'catalogue' or final_prompt is null)
);

create index ai_generations_status_idx on public.ai_generations (status, created_at);
create index ai_generations_suit_idx on public.ai_generations (suit_id, created_at desc);
create index ai_generations_spend_idx on public.ai_generations (kind, created_at) include (cost_usd_micro);

alter table public.suit_images
  add constraint suit_images_generation_fk
  foreign key (generation_id) references public.ai_generations (id) on delete set null;

create table public.prompt_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (name in ('observe', 'direct', 'tryon')),
  version     integer not null check (version > 0),
  body        text not null,
  is_active   boolean not null default false,
  created_by  uuid references public.admins (user_id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (name, version)
);

create unique index prompt_templates_one_active_idx on public.prompt_templates (name) where is_active;

insert into public.prompt_templates (name, version, body, is_active) values
  ('observe', 1, $body$You are looking at photos of one ladies' suit from a shop in Lagos. Describe only what you can see. Fill every field of the schema. Do not guess colours that are not visible. Do not describe any person. If the photos do not show a ladies' garment, set is_garment to false.$body$, true),
  ('direct', 1, $body$Make a photo of one adult woman wearing the suit shown in the reference photos. Keep the suit exactly as photographed: same colour, cut, buttons, fabric texture and trim. Do not add pockets, logos or text. Plain light studio background, full length, natural pose, even daylight. Style notes: {{style_note}}. Details seen in the photos: {{observation}}. {{extra}} OWNER_TO_FILL$body$, true),
  ('tryon', 1, $body$The first image is a photo of a person. The second image is a suit. Show the same person wearing this suit. Keep the face, skin tone, body shape and pose unchanged. Keep the suit exactly as shown. Plain background is fine.$body$, true);

create table public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.admins (user_id) on delete set null
);

create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (key, value) values
  ('ai_monthly_cap_usd_micro', '9000000'),
  ('tryon_monthly_cap_usd_micro', '2000000'),
  ('ai_kill_switch', 'false'),
  ('tryon_enabled', 'false'),
  ('tryon_per_visitor_per_day', '3'),
  ('tryon_per_address_per_day', '10'),
  ('gen_per_suit_per_day', '6'),
  ('price_rates', '{"observe_input_per_mtok_usd_micro": 0, "observe_output_per_mtok_usd_micro": 0, "image_1k_usd_micro": 34000}'),
  ('ai_alert_month', 'null'),
  ('style_notes', '{"london": "OWNER_TO_FILL", "turkey": "OWNER_TO_FILL"}');
