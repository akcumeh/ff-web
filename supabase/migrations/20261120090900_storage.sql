insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('originals', 'originals', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('candidates', 'candidates', false, 10485760, array['image/webp', 'image/png', 'image/jpeg']),
  ('public-suits', 'public-suits', true, 10485760, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;
