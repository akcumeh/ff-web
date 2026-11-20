alter table public.admins            enable row level security;
alter table public.audit_log         enable row level security;
alter table public.batches           enable row level security;
alter table public.suits             enable row level security;
alter table public.suit_variants     enable row level security;
alter table public.suit_images       enable row level security;
alter table public.ai_generations    enable row level security;
alter table public.prompt_templates  enable row level security;
alter table public.settings          enable row level security;
alter table public.channel_posts     enable row level security;
alter table public.channel_snapshots enable row level security;
alter table public.visitors          enable row level security;
alter table public.events            enable row level security;
alter table public.daily_counts      enable row level security;
alter table public.enquiries         enable row level security;
alter table public.orders            enable row level security;
alter table public.payment_events    enable row level security;
alter table public.rate_limits       enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

grant select on public.suits, public.suit_variants, public.suit_images to anon;

create policy "anon reads published suits"
  on public.suits for select
  to anon
  using (status = 'published');

create policy "anon reads variants of published suits"
  on public.suit_variants for select
  to anon
  using (exists (
    select 1 from public.suits s
    where s.id = suit_variants.suit_id and s.status = 'published'
  ));

create policy "anon reads public images of published suits"
  on public.suit_images for select
  to anon
  using (
    kind in ('final', 'detail')
    and exists (
      select 1 from public.suits s
      where s.id = suit_images.suit_id and s.status = 'published'
    )
  );
