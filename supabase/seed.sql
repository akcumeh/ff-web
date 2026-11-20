-- Local sample data only. `supabase db reset` loads this file; `db push` never sends it to a hosted project.
-- Prices, colours and sizes are samples, not real stock.

insert into public.batches (id, label, arrived_on, note) values
  ('b0000000-0000-4000-8000-000000000001', 'September 2026, first batch', '2026-09-15', 'Sample batch'),
  ('b0000000-0000-4000-8000-000000000002', 'November 2026, first batch', '2026-11-10', 'Sample batch');

insert into public.suits (id, style, title, description, price_kobo, status, batch_id, published_at) values
  ('a0000000-0000-4000-8000-000000000001', 'london', 'London style', 'Long jacquard jacket over a matching dress. Sample suit for local work.', 4500000, 'published', 'b0000000-0000-4000-8000-000000000001', '2026-09-18 09:00+01'),
  ('a0000000-0000-4000-8000-000000000002', 'turkey', 'Turkey style', 'Skirt suit with a lace-panelled jacket. Sample suit for local work.', 3800000, 'published', 'b0000000-0000-4000-8000-000000000001', '2026-09-18 09:10+01'),
  ('a0000000-0000-4000-8000-000000000003', 'london', 'London style', 'Herringbone jacket over a plain dress. Sample suit for local work.', 4200000, 'published', 'b0000000-0000-4000-8000-000000000001', '2026-09-19 09:00+01'),
  ('a0000000-0000-4000-8000-000000000004', 'turkey', 'Turkey style', 'Long jacket with a matching dress. Sample suit for local work.', 3600000, 'published', 'b0000000-0000-4000-8000-000000000001', '2026-09-19 09:10+01'),
  ('a0000000-0000-4000-8000-000000000005', 'london', 'London style', 'Skirt suit with a fitted jacket. Sample suit for local work.', 4800000, 'published', 'b0000000-0000-4000-8000-000000000002', '2026-11-12 09:00+01'),
  ('a0000000-0000-4000-8000-000000000006', 'turkey', 'Turkey style', 'Herringbone jacket over a dress. Sample suit for local work.', 3900000, 'published', 'b0000000-0000-4000-8000-000000000002', '2026-11-12 09:10+01'),
  ('a0000000-0000-4000-8000-000000000007', 'london', 'London style', 'Jacquard coat over a matching dress. Sample suit for local work.', 5200000, 'published', 'b0000000-0000-4000-8000-000000000002', '2026-11-13 09:00+01'),
  ('a0000000-0000-4000-8000-000000000008', 'turkey', 'Turkey style', 'Skirt suit with lace panels. Sample suit for local work.', 4100000, 'published', 'b0000000-0000-4000-8000-000000000002', '2026-11-14 09:00+01'),
  ('a0000000-0000-4000-8000-000000000009', 'london', 'London style', 'Herringbone jacket with a long dress. Sample suit for local work.', 4600000, 'published', 'b0000000-0000-4000-8000-000000000002', '2026-11-15 09:00+01'),
  ('a0000000-0000-4000-8000-000000000010', 'turkey', 'Turkey style', 'Long coat over a matching dress. Sample suit for local work.', 4400000, 'published', 'b0000000-0000-4000-8000-000000000002', '2026-11-16 09:00+01'),
  ('a0000000-0000-4000-8000-000000000011', 'london', 'London style', 'Skirt suit with a lace jacket. Sample suit for local work.', 5000000, 'published', 'b0000000-0000-4000-8000-000000000002', '2026-11-17 09:00+01'),
  ('a0000000-0000-4000-8000-000000000012', 'turkey', 'Turkey style', 'Herringbone jacket and dress. Sample suit for local work.', 3700000, 'published', 'b0000000-0000-4000-8000-000000000002', '2026-11-18 09:00+01');

insert into public.suit_variants (suit_id, colour, colour_hex, size, in_stock)
select s.id, v.colour, v.hex, sz.size, not (s.id = 'a0000000-0000-4000-8000-000000000004')
from public.suits s
join (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'Cream', '#efe3c8'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'Purple', '#5b2a6e'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'Lilac', '#b8a2cf'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'Cream', '#efe3c8'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'Purple', '#5b2a6e'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'Navy', '#1d2b4a'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'Lilac', '#b8a2cf'),
  ('a0000000-0000-4000-8000-000000000007'::uuid, 'Cream', '#efe3c8'),
  ('a0000000-0000-4000-8000-000000000008'::uuid, 'Purple', '#5b2a6e'),
  ('a0000000-0000-4000-8000-000000000008'::uuid, 'Wine', '#6e1f2e'),
  ('a0000000-0000-4000-8000-000000000009'::uuid, 'Lilac', '#b8a2cf'),
  ('a0000000-0000-4000-8000-000000000010'::uuid, 'Cream', '#efe3c8'),
  ('a0000000-0000-4000-8000-000000000011'::uuid, 'Purple', '#5b2a6e'),
  ('a0000000-0000-4000-8000-000000000012'::uuid, 'Lilac', '#b8a2cf'),
  ('a0000000-0000-4000-8000-000000000012'::uuid, 'Black', '#1a1a1a')
) as v (suit_id, colour, hex) on v.suit_id = s.id
cross join (values ('10'), ('12'), ('14'), ('16')) as sz (size);
