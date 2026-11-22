update public.settings
set value = value
  || jsonb_build_object('observe_input_per_mtok_usd_micro', 250000, 'observe_output_per_mtok_usd_micro', 1500000)
where key = 'price_rates';
